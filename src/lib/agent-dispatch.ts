import { findRealEmergencyServices, EmergencyService, getEmergencyContacts } from '@/lib/emergency-services';

export interface AutoEscalationResult {
  triggered: boolean;
  reason: string;
  authority?: {
    id: string;
    name: string;
    type: string;
    phone: string;
    emergencyPhone?: string;
    email?: string;
    address: string;
    distanceKm: number;
  };
  actions: {
    emailOpened: boolean;
    emailSubmitted: boolean;
    callOpened: boolean;
    callNumber?: string;
  };
  messagePreview: string;
  createdAt: string;
}

const extractEmail = (service: EmergencyService): string | undefined => {
  const candidates = [service.website, service.phone, service.address];
  for (const value of candidates) {
    if (!value) continue;
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) return match[0];
  }
  return undefined;
};

const pickDialNumber = (service: EmergencyService): string => {
  const raw = service.phone !== 'N/A' ? service.phone : service.emergencyPhone || '112';
  return raw.replace(/[^\d+]/g, '');
};

const buildDispatchMessage = (args: {
  reporterName: string;
  reporterEmail: string;
  reporterScore: number;
  description: string;
  category: string;
  severity: number;
  location: { lat: number; lng: number; address?: string };
  authorityName: string;
  incidentId: string;
}): string => {
  const coords = `${args.location.lat.toFixed(5)}, ${args.location.lng.toFixed(5)}`;
  const locationLines = args.location.address?.trim()
    ? [`Address: ${args.location.address.trim()}`, `Coordinates: ${coords}`]
    : [`Location: ${coords}`];

  return [
    'CITYWATCH AGENTIC AUTO-ESCALATION',
    '---------------------------------',
    `Incident ID: ${args.incidentId}`,
    `Severity: ${args.severity}/5 (Emergency)`,
    `Category: ${args.category}`,
    `Trusted Citizen Score: ${args.reporterScore}`,
    `Reporter: ${args.reporterName} <${args.reporterEmail}>`,
    `Authority Target: ${args.authorityName}`,
    ...locationLines,
    `Map: https://www.openstreetmap.org/?mlat=${args.location.lat}&mlon=${args.location.lng}#map=16/${args.location.lat}/${args.location.lng}`,
    '',
    'Report:',
    args.description,
    '',
    'This message was auto-dispatched by CityWatch because the reporter is a high-trust citizen (score ≥ 100 / Elite) and AI severity is 5.',
  ].join('\n');
};

const openExternalHref = (href: string): boolean => {
  try {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
};

const openMailClient = (to: string, subject: string, body: string): boolean => {
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return openExternalHref(href);
};

const openDialer = (phone: string): boolean => {
  return openExternalHref(`tel:${phone}`);
};

/** Free silent email attempt via FormSubmit (no billing / no paid API). */
const submitFreeEmail = async (to: string, subject: string, message: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: subject,
        message,
        _template: 'table',
        _captcha: 'false',
      }),
    });
    return response.ok;
  } catch (error) {
    console.warn('Free email submit failed:', error);
    return false;
  }
};

export const shouldAutoEscalate = (score: number | undefined, severity: number | undefined): boolean => {
  // Elite threshold: score >= 100 + severity 5 emergency
  return Number(score || 0) >= 100 && Number(severity || 0) === 5;
};

const FAST_LOOKUP_BUDGET_MS = 7000;

export const runAgenticAutoDispatch = async (args: {
  incidentId: string;
  userScore: number;
  userName: string;
  userEmail: string;
  description: string;
  category: string;
  severity: number;
  location: { lat: number; lng: number; address?: string };
  /** Skip mailto/tel popups (used when backfilling from admin dashboard) */
  silent?: boolean;
}): Promise<AutoEscalationResult> => {
  if (!shouldAutoEscalate(args.userScore, args.severity)) {
    return {
      triggered: false,
      reason: 'Auto-escalation requires citizen score ≥ 100 (Elite) and severity level 5.',
      actions: { emailOpened: false, emailSubmitted: false, callOpened: false },
      messagePreview: '',
      createdAt: new Date().toISOString(),
    };
  }

  const contacts = getEmergencyContacts('india');
  const fallbackAuthority: EmergencyService = {
    id: 'national_emergency',
    name: 'National Emergency Dispatch (112)',
    type: 'other',
    category: 'Emergency Contact',
    phone: contacts.Police || '100',
    emergencyPhone: '112',
    address: 'India Emergency Network',
    location: args.location,
    distance: 0,
    responseTime: 3,
    isAvailable: true,
  };

  // Use fast Overpass lookup; fall back to 112 if mirrors time out (504)
  let authority: EmergencyService = fallbackAuthority;
  if (!args.silent) {
    try {
      const nearest = await Promise.race([
        findRealEmergencyServices(
          args.location,
          args.category,
          args.severity,
          args.description,
          { fast: true }
        ).catch(() => [] as EmergencyService[]),
        new Promise<EmergencyService[]>((resolve) =>
          setTimeout(() => resolve([]), FAST_LOOKUP_BUDGET_MS)
        ),
      ]);
      if (nearest[0]) authority = nearest[0];
    } catch (error) {
      console.warn('Nearest authority lookup failed; using national emergency fallback:', error);
    }
  }

  const authorityEmail =
    extractEmail(authority) ||
    (import.meta.env.VITE_ESCALATION_EMAIL as string | undefined) ||
    undefined;

  const message = buildDispatchMessage({
    reporterName: args.userName,
    reporterEmail: args.userEmail,
    reporterScore: args.userScore,
    description: args.description,
    category: args.category,
    severity: args.severity,
    location: args.location,
    authorityName: authority.name,
    incidentId: args.incidentId,
  });

  const subject = `[CityWatch AUTO] Severity 5 ${args.category} — ${authority.name}`;
  const dialNumber = pickDialNumber(authority);

  let emailOpened = false;
  let emailSubmitted = false;
  let callOpened = false;

  if (authorityEmail) {
    emailSubmitted = await submitFreeEmail(authorityEmail, subject, message);
    if (!args.silent) {
      emailOpened = openMailClient(authorityEmail, subject, message);
    }
  } else if (!args.silent) {
    // No known email: open mail to blank compose so trusted citizen/ops can still send instantly.
    emailOpened = openMailClient('', subject, message);
  }

  // User-gesture friendly: attempt dialer open as part of submit flow.
  if (!args.silent) {
    callOpened = openDialer(dialNumber);
  }

  return {
    triggered: true,
    reason: 'Trusted Elite citizen (score ≥ 100) reported a severity-5 emergency. Agent dispatched the nearest authority automatically.',
    authority: {
      id: authority.id,
      name: authority.name,
      type: authority.type,
      phone: authority.phone,
      emergencyPhone: authority.emergencyPhone,
      email: authorityEmail,
      address: authority.address,
      distanceKm: authority.distance,
    },
    actions: {
      emailOpened,
      emailSubmitted,
      callOpened,
      callNumber: dialNumber,
    },
    messagePreview: message,
    createdAt: new Date().toISOString(),
  };
};
