export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

export interface SeverityMeta {
  level: SeverityLevel;
  label: string;
  hex: string;
  badgeClass: string;
}

/** Single source of truth — matches AI analysis scale used across the app. */
export const SEVERITY_SCALE: readonly SeverityMeta[] = [
  { level: 1, label: "Low", hex: "#10b981", badgeClass: "severity-1" },
  { level: 2, label: "Medium", hex: "#f59e0b", badgeClass: "severity-2" },
  { level: 3, label: "High", hex: "#f97316", badgeClass: "severity-3" },
  { level: 4, label: "Critical", hex: "#ef4444", badgeClass: "severity-4" },
  { level: 5, label: "Emergency", hex: "#dc2626", badgeClass: "severity-5" },
] as const;

const severityByLevel = Object.fromEntries(
  SEVERITY_SCALE.map((entry) => [entry.level, entry])
) as Record<SeverityLevel, SeverityMeta>;

export const SEVERITY_AI_PROMPT = `Severity levels (use exactly this scale):
1 = Low — minor inconvenience, no safety risk
2 = Medium — noticeable issue, limited impact
3 = High — significant problem affecting many people
4 = Critical — urgent, major safety or service disruption
5 = Emergency — life-threatening or city-wide emergency`;

export function normalizeSeverity(level: number | undefined | null): SeverityLevel | null {
  if (level == null || Number.isNaN(level)) return null;
  const rounded = Math.round(Number(level));
  if (rounded < 1 || rounded > 5) return null;
  return rounded as SeverityLevel;
}

export function getSeverityMeta(level: number | undefined | null): SeverityMeta {
  const normalized = normalizeSeverity(level);
  return normalized ? severityByLevel[normalized] : severityByLevel[3];
}

export function getSeverityLabel(level: number | undefined | null): string {
  return getSeverityMeta(level).label;
}

export function getSeverityHex(level: number | undefined | null): string {
  return getSeverityMeta(level).hex;
}

export function getSeverityBadgeClass(level: number | undefined | null): string {
  return getSeverityMeta(level).badgeClass;
}

export function formatSeverity(level: number | undefined | null): string {
  const meta = getSeverityMeta(level);
  return `Level ${meta.level} — ${meta.label}`;
}

export function getIncidentSeverity(incident: {
  severity?: number;
  aiAnalysis?: { severity?: number };
}): SeverityLevel {
  const topLevel = normalizeSeverity(incident.severity);
  const nested = normalizeSeverity(incident.aiAnalysis?.severity);
  return topLevel ?? nested ?? 3;
}
