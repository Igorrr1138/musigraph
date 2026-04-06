export interface TrackRatingCriterion {
  id: string;
  label: string;
  enabled: boolean;
}

export const DEFAULT_TRACK_RATING_CRITERIA: TrackRatingCriterion[] = [
  { id: "lyrics", label: "Lyrics", enabled: true },
  { id: "instrumental-part", label: "Instrumental Part", enabled: true },
  { id: "energy", label: "Energy", enabled: true },
  { id: "complexity", label: "Complexity", enabled: true },
  { id: "mood", label: "Mood", enabled: true },
  { id: "solo", label: "Solo", enabled: true },
  { id: "vocal", label: "Vocal", enabled: true },
  { id: "intro", label: "Intro", enabled: true },
  { id: "outro", label: "Outro", enabled: true },
];

export const ALBUM_MOOD_OPTIONS = [
  "Joy / Uplift",
  "Sadness / Melancholy",
  "Calm / Relaxation",
  "Drive / Energy",
  "Nostalgia",
  "Heroism / Triumph",
  "Anxiety / Fear",
  "Dreaminess",
  "Azart",
  "Excitement",
] as const;

export type CriteriaRatingMap = Record<string, number>;

function slugifyLabel(label: string) {
  return label
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeTrackRatingCriteria(value: unknown): TrackRatingCriterion[] {
  if (!Array.isArray(value)) {
    return DEFAULT_TRACK_RATING_CRITERIA;
  }

  const sanitized = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;

      const rawId = "id" in entry ? entry.id : undefined;
      const rawLabel = "label" in entry ? entry.label : undefined;
      const rawEnabled = "enabled" in entry ? entry.enabled : true;

      const label =
        typeof rawLabel === "string" && rawLabel.trim()
          ? rawLabel.trim()
          : typeof rawId === "string" && rawId.trim()
            ? rawId
                .split("-")
                .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
                .join(" ")
            : "";

      if (!label) return null;

      const id =
        typeof rawId === "string" && rawId.trim() ? slugifyLabel(rawId) : slugifyLabel(label);

      if (!id) return null;

      return {
        id,
        label,
        enabled: Boolean(rawEnabled),
      };
    })
    .filter((entry): entry is TrackRatingCriterion => Boolean(entry));

  if (!sanitized.length) {
    return DEFAULT_TRACK_RATING_CRITERIA;
  }

  const unique = new Map<string, TrackRatingCriterion>();
  sanitized.forEach((criterion) => {
    if (!unique.has(criterion.id)) {
      unique.set(criterion.id, criterion);
    }
  });

  return Array.from(unique.values());
}

export function createCriterion(label: string): TrackRatingCriterion | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const id = slugifyLabel(trimmed);
  if (!id) return null;

  return {
    id,
    label: trimmed,
    enabled: true,
  };
}

export function moveCriterion(
  criteria: TrackRatingCriterion[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= criteria.length) {
    return criteria;
  }

  const next = [...criteria];
  const [removed] = next.splice(index, 1);
  next.splice(nextIndex, 0, removed);
  return next;
}

export function getEnabledCriteria(criteria: TrackRatingCriterion[]) {
  return criteria.filter((criterion) => criterion.enabled);
}

export function sanitizeCriteriaRatings(value: unknown): CriteriaRatingMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, rawValue]) => {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) return null;
      const clamped = Math.max(1, Math.min(10, Math.round(numericValue)));
      return [key, clamped] as const;
    })
    .filter((entry): entry is readonly [string, number] => Boolean(entry));

  return Object.fromEntries(entries);
}

export function getCriteriaAverage(criteriaRatings: CriteriaRatingMap) {
  const values = Object.values(criteriaRatings);
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(average.toFixed(1));
}
