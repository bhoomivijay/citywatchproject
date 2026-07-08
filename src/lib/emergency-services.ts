// Free nearest-authority lookup via OpenStreetMap Overpass API (no billing / no API key).

export interface EmergencyService {
  id: string;
  name: string;
  type: 'police' | 'fire' | 'hospital' | 'ambulance' | 'municipal' | 'traffic' | 'environmental' | 'other';
  category: string;
  phone: string;
  emergencyPhone?: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  distance: number; // in km
  responseTime: number; // in minutes
  isAvailable: boolean;
  rating?: number;
  openNow?: boolean;
  website?: string;
  operatingHours?: string;
}

export interface AuthorityMapping {
  [key: string]: {
    types: Array<EmergencyService['type']>;
    priority: number;
    searchRadius: number; // meters
    overpassFilters: string[];
  };
}

export const AUTHORITY_MAPPING: AuthorityMapping = {
  'Public Unrest': {
    types: ['police'],
    priority: 1,
    searchRadius: 5000,
    overpassFilters: ['["amenity"="police"]'],
  },
  'Infrastructure': {
    types: ['municipal'],
    priority: 2,
    searchRadius: 4000,
    overpassFilters: [
      '["office"="government"]',
      '["amenity"="townhall"]',
      '["government"="public_service"]',
    ],
  },
  'Environmental': {
    types: ['environmental', 'municipal'],
    priority: 2,
    searchRadius: 5000,
    overpassFilters: [
      '["office"="government"]',
      '["amenity"="recycling"]',
      '["amenity"="waste_disposal"]',
    ],
  },
  'Traffic': {
    types: ['traffic', 'police'],
    priority: 1,
    searchRadius: 4000,
    overpassFilters: [
      '["amenity"="police"]',
      '["highway"="traffic_signals"]',
    ],
  },
  'Power Outage': {
    types: ['municipal'],
    priority: 2,
    searchRadius: 5000,
    overpassFilters: [
      '["office"="government"]',
      '["power"="substation"]',
      '["amenity"="townhall"]',
    ],
  },
  'Water Issue': {
    types: ['municipal'],
    priority: 2,
    searchRadius: 5000,
    overpassFilters: [
      '["office"="government"]',
      '["man_made"="water_works"]',
      '["amenity"="townhall"]',
    ],
  },
  'Health': {
    types: ['hospital', 'ambulance'],
    priority: 1,
    searchRadius: 6000,
    overpassFilters: [
      '["amenity"="hospital"]',
      '["amenity"="clinic"]',
      '["amenity"="doctors"]',
      '["emergency"="ambulance_station"]',
      '["healthcare"="hospital"]',
      '["healthcare"="clinic"]',
    ],
  },
  'Safety': {
    types: ['fire', 'police'],
    priority: 1,
    searchRadius: 5000,
    overpassFilters: [
      '["amenity"="fire_station"]',
      '["amenity"="police"]',
    ],
  },
  'Other': {
    types: ['municipal', 'police'],
    priority: 3,
    searchRadius: 4000,
    overpassFilters: [
      '["amenity"="police"]',
      '["office"="government"]',
      '["amenity"="townhall"]',
    ],
  },
};

const CATEGORY_TO_AUTHORITY_KEY: Record<string, keyof typeof AUTHORITY_MAPPING> = {
  health: 'Health',
  medical: 'Health',
  'medical problem': 'Health',
  'medical emergency': 'Health',
  healthcare: 'Health',
  hospital: 'Health',
  safety: 'Safety',
  fire: 'Safety',
  environmental: 'Environmental',
  environment: 'Environmental',
  pollution: 'Environmental',
  traffic: 'Traffic',
  infrastructure: 'Infrastructure',
  'public unrest': 'Public Unrest',
  'power outage': 'Power Outage',
  'water issue': 'Water Issue',
  other: 'Other',
};

const resolveAuthorityConfig = (incidentType: string) => {
  if (AUTHORITY_MAPPING[incidentType]) {
    return AUTHORITY_MAPPING[incidentType];
  }
  const mapped = CATEGORY_TO_AUTHORITY_KEY[incidentType.toLowerCase().trim()];
  return AUTHORITY_MAPPING[mapped || 'Other'];
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

type OverpassElement = {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateResponseTimeFromDistance = (distanceKm: number, severity: number): number => {
  let baseTime = 5 + Math.ceil(distanceKm * 2);
  if (severity >= 4) {
    baseTime = Math.max(3, baseTime - 3);
  }
  return Math.max(3, baseTime);
};

const inferServiceType = (
  tags: Record<string, string>,
  preferred: Array<EmergencyService['type']>
): EmergencyService['type'] => {
  const amenity = (tags.amenity || '').toLowerCase();
  const office = (tags.office || '').toLowerCase();
  const emergency = (tags.emergency || '').toLowerCase();

  if (amenity === 'police') return preferred.includes('traffic') ? 'traffic' : 'police';
  if (amenity === 'fire_station') return 'fire';
  if (amenity === 'hospital' || amenity === 'clinic') return 'hospital';
  if (emergency === 'ambulance_station') return 'ambulance';
  if (office === 'government' || amenity === 'townhall') return 'municipal';
  if (amenity === 'recycling' || amenity === 'waste_disposal') return 'environmental';
  return preferred[0] || 'other';
};

const getEmergencyPhoneForType = (type: EmergencyService['type']): string => {
  switch (type) {
    case 'police':
    case 'traffic':
      return '100';
    case 'fire':
      return '101';
    case 'hospital':
    case 'ambulance':
      return '102';
    default:
      return '112';
  }
};

const formatAddressFromTags = (tags: Record<string, string>): string | null => {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:locality'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:district'],
    tags['addr:state'],
    tags['addr:postcode'],
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  if (tags['addr:full']) return tags['addr:full'];
  if (tags['addr:place']) return tags['addr:place'];
  return null;
};

const reverseGeocodeDetails = async (
  lat: number,
  lng: number
): Promise<{ address: string; phoneHint?: string }> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      }
    );
    if (!response.ok) {
      throw new Error(`Nominatim ${response.status}`);
    }
    const data = await response.json();
    const addr = (data?.address || {}) as Record<string, string>;
    const preciseParts = [
      data?.name,
      addr.amenity,
      addr.building,
      [addr.house_number, addr.road].filter(Boolean).join(' '),
      addr.neighbourhood || addr.suburb || addr.quarter,
      addr.village || addr.town || addr.city || addr.municipality,
      addr.state_district,
      addr.state,
      addr.postcode,
    ]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);

    // De-duplicate consecutive identical parts
    const uniqueParts: string[] = [];
    for (const part of preciseParts) {
      if (!uniqueParts.length || uniqueParts[uniqueParts.length - 1].toLowerCase() !== part.toLowerCase()) {
        uniqueParts.push(part);
      }
    }

    const address =
      uniqueParts.length > 0
        ? uniqueParts.slice(0, 6).join(', ')
        : typeof data?.display_name === 'string'
          ? data.display_name
          : `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    return { address };
  } catch (error) {
    console.warn('Reverse geocode failed:', error);
    return { address: `Near ${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
};

const isVagueAddress = (address?: string): boolean => {
  if (!address) return true;
  if (address.includes('unavailable')) return true;

  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return true;

  // "Alwar, Rajasthan, 301001" is still vague (city/state/PIN only).
  const withoutPin = parts.filter((p) => !/^\d{5,6}$/.test(p));
  if (withoutPin.length <= 2) return true;

  // Treat as precise only if street / locality cues exist (not just city name + PIN digits).
  const hasStreetOrLocality =
    /\b(road|rd|street|st|marg|nagar|colony|market|sector|lane|avenue|cross|block|phase|bus stand|railway|chowk|circle|hospital|clinic|medical)\b/i.test(
      address
    ) || /\b\d+[A-Za-z]?\b/.test(address); // house/plot numbers like 12 or 12A, not whole PIN alone

  // If the only digits in the whole string are a pincode, it's still vague.
  const digits = address.match(/\d+/g) || [];
  const onlyPincodeDigits = digits.length > 0 && digits.every((d) => /^\d{5,6}$/.test(d));
  if (onlyPincodeDigits && !/\b(road|rd|street|st|marg|nagar|colony|market|sector|lane|avenue)\b/i.test(address)) {
    return true;
  }

  return !hasStreetOrLocality;
};

/** Free OSM Nominatim search enrichment: better street/locality address when available. */
const enrichWithNominatimSearch = async (
  service: EmergencyService
): Promise<Partial<EmergencyService>> => {
  try {
    // Prefer named place lookup (works better outside well-mapped cities).
    const queries = [
      `${service.name}, ${service.location.lat},${service.location.lng}`,
      service.name,
    ];

    for (const query of queries) {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}` +
        `&limit=3&addressdetails=1&extratags=1`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      });
      const text = await response.text();
      if (!response.ok) continue;
      let results: any[] = [];
      try {
        results = JSON.parse(text);
      } catch {
        continue;
      }
      if (!Array.isArray(results) || results.length === 0) continue;

      // Prefer closest hit to reported coordinates
      const ranked = results
        .map((hit: any) => {
          const lat = Number(hit.lat);
          const lon = Number(hit.lon);
          const distance =
            Number.isFinite(lat) && Number.isFinite(lon)
              ? calculateDistance(service.location.lat, service.location.lng, lat, lon)
              : 999;
          return { hit, distance };
        })
        .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

      const best = ranked[0]?.hit;
      if (!best) continue;

      const addr = (best.address || {}) as Record<string, string>;
      const extratags = (best.extratags || {}) as Record<string, string>;
      const parts = [
        best.name,
        [addr.house_number, addr.road].filter(Boolean).join(' '),
        addr.neighbourhood || addr.suburb || addr.quarter || addr.residential,
        addr.village || addr.town || addr.city || addr.municipality,
        addr.county || addr.state_district,
        addr.state,
        addr.postcode,
      ]
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean);

      const unique: string[] = [];
      for (const part of parts) {
        if (!unique.length || unique[unique.length - 1].toLowerCase() !== part.toLowerCase()) {
          unique.push(part);
        }
      }

      const address =
        unique.length >= 3
          ? unique.slice(0, 7).join(', ')
          : best.display_name || service.address;

      const phone =
        extratags.phone ||
        extratags['contact:phone'] ||
        addr.phone ||
        undefined;

      return {
        address,
        phone: phone || service.phone,
      };
    }

    return {};
  } catch (error) {
    console.warn('Nominatim search enrichment failed:', error);
    return {};
  }
};

const enrichAddresses = async (services: EmergencyService[]): Promise<EmergencyService[]> => {
  const limited = services.slice(0, 8);
  const enriched: EmergencyService[] = [];

  for (const service of limited) {
    let next: EmergencyService = { ...service };

    // Always refine vague city-level addresses (e.g. "Alwar, Rajasthan, 301001").
    if (isVagueAddress(next.address)) {
      const geo = await reverseGeocodeDetails(next.location.lat, next.location.lng);
      if (!isVagueAddress(geo.address)) {
        next = { ...next, address: geo.address };
      } else if (geo.address && geo.address.length > (next.address?.length || 0)) {
        // Use reverse result even if still imperfect; next search pass can improve it.
        next = { ...next, address: geo.address };
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Second free pass: place search by hospital name (helps Alwar/etc where reverse is coarse).
    if (isVagueAddress(next.address) || !next.phone || next.phone === 'N/A') {
      const searched = await enrichWithNominatimSearch(next);
      next = {
        ...next,
        address:
          searched.address && (!isVagueAddress(searched.address) || (searched.address?.length || 0) > (next.address?.length || 0))
            ? searched.address
            : next.address,
        phone:
          searched.phone && searched.phone !== 'N/A'
            ? searched.phone
            : next.phone,
      };
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Final readable fallback: include landmark/hospital name with city if still coarse.
    if (isVagueAddress(next.address)) {
      next = {
        ...next,
        address: `${next.name}, ${next.address || `${next.location.lat.toFixed(4)}, ${next.location.lng.toFixed(4)}`}`,
      };
    }

    enriched.push(next);
  }

  return [...enriched, ...services.slice(enriched.length)];
};

const mapOverpassElement = (
  element: OverpassElement,
  incidentLocation: { lat: number; lng: number },
  preferredTypes: Array<EmergencyService['type']>,
  severity: number
): EmergencyService | null => {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  const tags = element.tags || {};
  const type = inferServiceType(tags, preferredTypes);
  const distance = calculateDistance(incidentLocation.lat, incidentLocation.lng, lat, lng);
  const name =
    tags.name ||
    tags['name:en'] ||
    tags.operator ||
    `${type.charAt(0).toUpperCase()}${type.slice(1)} facility`;

  const taggedAddress = formatAddressFromTags(tags);

  return {
    id: `osm_${element.type}_${element.id}`,
    name,
    type,
    category: tags.amenity || tags.office || tags.emergency || 'Emergency Service',
    phone:
      tags.phone ||
      tags['contact:phone'] ||
      tags['emergency:phone'] ||
      tags['phone:mobile'] ||
      tags['contact:mobile'] ||
      'N/A',
    emergencyPhone: getEmergencyPhoneForType(type),
    address: taggedAddress || 'Address unavailable (OpenStreetMap)',
    location: { lat, lng },
    distance: Math.round(distance * 100) / 100,
    responseTime: calculateResponseTimeFromDistance(distance, severity),
    isAvailable: true,
    openNow: true,
    website: tags.website || tags['contact:website'],
    operatingHours: tags.opening_hours,
  };
};

const buildOverpassQuery = (
  location: { lat: number; lng: number },
  filters: string[],
  radiusMeters: number
): string => {
  const aroundClauses = filters
    .flatMap((filter) => [
      `node${filter}(around:${radiusMeters},${location.lat},${location.lng});`,
      `way${filter}(around:${radiusMeters},${location.lat},${location.lng});`,
      `relation${filter}(around:${radiusMeters},${location.lat},${location.lng});`,
    ])
    .join('\n      ');

  return `
    [out:json][timeout:25];
    (
      ${aroundClauses}
    );
    out center tags 30;
  `;
};

const FAST_OVERPASS_TIMEOUT_MS = 6000;
const DEFAULT_OVERPASS_TIMEOUT_MS = 12000;

const queryOverpass = async (
  query: string,
  timeoutMs = DEFAULT_OVERPASS_TIMEOUT_MS
): Promise<OverpassElement[]> => {
  let lastError: unknown;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'CityWatch/1.0 (smart-city demo; OpenStreetMap Overpass client)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        // Fail fast on gateway timeouts — try next mirror immediately
        throw new Error(`Overpass HTTP ${response.status}`);
      }

      const text = await response.text();
      let payload: { elements?: OverpassElement[] };
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`Overpass returned non-JSON from ${endpoint}`);
      }

      return Array.isArray(payload?.elements) ? payload.elements : [];
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed (${endpoint}):`, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass query failed');
};

const removeDuplicateServices = (services: EmergencyService[]): EmergencyService[] => {
  const seen = new Set<string>();
  return services.filter((service) => {
    const key = `${service.name.toLowerCase()}-${service.location.lat.toFixed(4)}-${service.location.lng.toFixed(4)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** Rank how relevant a facility is to the reported incident text. */
const scoreAuthorityRelevance = (
  service: EmergencyService,
  contextText: string,
  needsEmergencyCare: boolean
): number => {
  const haystack = `${service.name} ${service.category} ${service.address}`.toLowerCase();
  let score = 0;

  // Base by facility type
  if (service.type === 'hospital') score += 40;
  else if (service.type === 'ambulance') score += 35;
  else if (service.type === 'fire') score += 20;
  else if (service.type === 'police' || service.type === 'traffic') score += 15;
  else score += 5;

  // Prefer general / emergency-capable hospitals for acute cases
  if (/\b(hospital|medical college|multi.?speciality|multispecialty|general|emergency|trauma|casualty)\b/.test(haystack)) {
    score += 25;
  }
  if (/\b(emergency|casualty|icu|trauma)\b/.test(haystack)) {
    score += 20;
  }

  // Strong match for cardiac emergencies
  if (/\b(heart|cardiac|cardio|chest pain|attack)\b/.test(contextText)) {
    if (/\b(cardio|cardiac|heart)\b/.test(haystack)) score += 50;
    if (/\b(diabetes|diabetic|eye|dental|skin|dermat|ortho|orthopaedic|ent|cosmetic|fertility|ivf|ayurved)\b/.test(haystack)) {
      score -= 70;
    }
  }

  // Strong match for eye injuries
  if (/\b(eye|vision|ocular)\b/.test(contextText)) {
    if (/\b(eye|ophthal|vision)\b/.test(haystack)) score += 50;
  }

  // Generic penalty for specialty clinics when we need emergency care
  if (needsEmergencyCare) {
    if (/\b(diabetes|diabetic|dental|skin|dermat|cosmetic|fertility|ivf|ayurved|optical|optics)\b/.test(haystack)) {
      score -= 80;
    }
    if (/\b(clinic)\b/.test(haystack) && !/\b(hospital|emergency|trauma)\b/.test(haystack)) {
      score -= 20;
    }
  }

  // Prefer closer places lightly (distance is still primary sort tie-breaker)
  score -= Math.min(15, service.distance);

  return score;
};

export const getEmergencyContacts = (region: string = 'india'): { [key: string]: string } => {
  const contacts = {
    india: {
      Police: '100',
      Fire: '101',
      Ambulance: '102',
      'Women Helpline': '1091',
      'Child Helpline': '1098',
      'Senior Citizen Helpline': '14567',
      'Railway Helpline': '139',
      'Tourist Helpline': '1363',
    },
  };

  return contacts[region as keyof typeof contacts] || contacts.india;
};

export const findRealEmergencyServices = async (
  incidentLocation: { lat: number; lng: number },
  incidentType: string,
  severity: number,
  incidentDescription: string = '',
  options?: { fast?: boolean }
): Promise<EmergencyService[]> => {
  const authorityConfig = resolveAuthorityConfig(incidentType);
  const radii = options?.fast
    ? [authorityConfig.searchRadius]
    : [authorityConfig.searchRadius, 8000, 12000, 18000];
  const overpassTimeout = options?.fast ? FAST_OVERPASS_TIMEOUT_MS : DEFAULT_OVERPASS_TIMEOUT_MS;
  const overpassQueryTimeout = options?.fast ? 10 : 20;
  const contextText = `${incidentType} ${incidentDescription}`.toLowerCase();
  const needsEmergencyCare =
    severity >= 4 ||
    /\b(heart|cardiac|attack|stroke|unconscious|bleeding|fracture|injury|injured|trauma|emergency|ambulance|burn|seizure|overdose)\b/.test(
      contextText
    );

  for (const radius of radii) {
    try {
      const query = buildOverpassQuery(
        incidentLocation,
        authorityConfig.overpassFilters,
        radius
      ).replace('[timeout:25]', `[timeout:${overpassQueryTimeout}]`);
      const elements = await queryOverpass(query, overpassTimeout);

      const services = elements
        .map((element) =>
          mapOverpassElement(element, incidentLocation, authorityConfig.types, severity)
        )
        .filter((service): service is EmergencyService => Boolean(service));

      const unique = removeDuplicateServices(services).sort((a, b) => {
        const scoreDiff =
          scoreAuthorityRelevance(b, contextText, needsEmergencyCare) -
          scoreAuthorityRelevance(a, contextText, needsEmergencyCare);
        if (scoreDiff !== 0) return scoreDiff;
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.responseTime - b.responseTime;
      });

      // For medical emergencies, prefer relevant hospitals even if a specialty clinic is closer.
      const preferred = needsEmergencyCare
        ? unique.filter((service) => scoreAuthorityRelevance(service, contextText, true) >= 20)
        : unique;

      const ranked = preferred.length > 0 ? preferred : unique;

      if (ranked.length > 0) {
        return await enrichAddresses(ranked.slice(0, 10));
      }
    } catch (error) {
      console.warn(`Nearest-authority lookup failed at ${radius}m:`, error);
    }
  }

  return [];
};

/** @deprecated kept for compatibility; no longer generates fake places */
export const generateLocalEmergencyServices = (
  _incidentLocation: { lat: number; lng: number },
  _incidentType: string
): EmergencyService[] => {
  return [];
};

export const checkServiceAvailability = async (_serviceId: string): Promise<boolean> => {
  return true;
};
