/**
 * Wikidata SPARQL client — PRIMARY source of the discography skeleton.
 *
 * The pipeline in `musicPipeline.ts` drives album chronology, classification
 * (album / EP / single), and genre from Wikidata; Deezer is used only to
 * enrich each Wikidata release with cover art, IDs, and tracklists.
 *
 * We resolve the artist QID via the Deezer-ID property (P2722) first, then
 * fall back to `wbsearchentities`. Every SPARQL request is bounded by a
 * short timeout and any failure returns null/[] so the caller can degrade
 * gracefully to a Deezer-only path.
 */

const WD_SPARQL = 'https://query.wikidata.org/sparql';
const WD_SEARCH = 'https://www.wikidata.org/w/api.php';
const DEFAULT_TIMEOUT = 8_000;

interface SparqlBinding {
  [key: string]: { type: string; value: string } | undefined;
}
interface SparqlResult {
  results?: { bindings?: SparqlBinding[] };
}

async function sparql(query: string, timeoutMs = DEFAULT_TIMEOUT): Promise<SparqlResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${WD_SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/sparql-results+json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as SparqlResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the Wikidata QID for a Deezer artist. Primary path: `P2722`
 * (Deezer artist ID). Fallback: search API filtered to music-related
 * descriptions. Returns null when both paths fail.
 */
export async function findArtistQid(
  deezerId: string,
  artistName?: string,
): Promise<string | null> {
  const byDeezer = `SELECT ?a WHERE { ?a wdt:P2722 "${deezerId}" . } LIMIT 1`;
  const r1 = await sparql(byDeezer, 5000);
  const uri = r1?.results?.bindings?.[0]?.a?.value;
  if (uri) return uri.split('/').pop() ?? null;

  if (!artistName) return null;
  try {
    const url = `${WD_SEARCH}?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&type=item&format=json&origin=*&limit=8`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { search?: Array<{ id: string; description?: string }> };
    const musicRe = /\b(musician|band|singer|group|composer|rapper|guitarist|drummer|artist|songwriter|producer|dj|duo|trio|quartet|ensemble|orchestra)\b/i;
    const hit = (j.search ?? []).find((s) => musicRe.test(s.description ?? '')) ?? j.search?.[0];
    return hit?.id ?? null;
  } catch {
    return null;
  }
}

export type WikidataRecordType = 'album' | 'ep' | 'single' | 'live' | 'compilation';

export interface WikidataRelease {
  qid: string;
  title: string;
  /** ISO date (YYYY-MM-DD) — earliest known P577. */
  date?: string;
  year?: number;
  /** Classification derived from P31 (subclass-aware). */
  record_type: WikidataRecordType;
}

const P31_TO_TYPE: Record<string, WikidataRecordType> = {
  Q482994: 'album',        // album
  Q208569: 'album',        // studio album
  Q222910: 'ep',           // extended play
  Q134556: 'single',       // single
  Q108352648: 'single',    // promotional single
  Q1885014: 'live',        // live album
  Q216337: 'live',         // concert film / live release
  Q209939: 'compilation',  // compilation album
  Q217199: 'compilation',  // greatest hits album
};

/**
 * Fetch the artist's full release skeleton in a SINGLE SPARQL query:
 * every release they performed on (P175) whose P31 (or a P279 ancestor)
 * is one of the known release classes. Returns earliest P577 date and
 * a derived record_type. Silent on error — caller decides fallback.
 */
export async function fetchArtistReleases(qid: string): Promise<WikidataRelease[]> {
  const releaseUnion = Object.keys(P31_TO_TYPE).map((q) => `wd:${q}`).join(' ');
  const q = `
    SELECT ?release ?releaseLabel ?type (MIN(?date) AS ?first) WHERE {
      VALUES ?type { ${releaseUnion} }
      ?release wdt:P175 wd:${qid} ;
               wdt:P31/wdt:P279* ?type .
      OPTIONAL { ?release wdt:P577 ?date . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,es". }
    } GROUP BY ?release ?releaseLabel ?type
  `;
  const r = await sparql(q);
  const rows = r?.results?.bindings ?? [];

  // A release can match multiple P31 rows (e.g. "album" + "live album").
  // Merge by QID and prefer the more specific record_type.
  const specificity: Record<WikidataRecordType, number> = {
    live: 4, compilation: 4, ep: 3, single: 3, album: 1,
  };
  const merged = new Map<string, WikidataRelease>();
  for (const row of rows) {
    const uri = row.release?.value ?? '';
    const rQid = uri.split('/').pop() ?? '';
    const title = row.releaseLabel?.value ?? '';
    if (!rQid || !title) continue;

    const typeQid = (row.type?.value ?? '').split('/').pop() ?? '';
    const recordType = P31_TO_TYPE[typeQid] ?? 'album';

    const rawDate = row.first?.value;
    const date = rawDate?.slice(0, 10);
    const yearNum = date ? parseInt(date.slice(0, 4), 10) : NaN;
    const year = Number.isFinite(yearNum) ? yearNum : undefined;

    const prev = merged.get(rQid);
    if (!prev) {
      merged.set(rQid, { qid: rQid, title, date, year, record_type: recordType });
      continue;
    }
    if (specificity[recordType] > specificity[prev.record_type]) {
      prev.record_type = recordType;
    }
    if (year && (!prev.year || year < prev.year)) {
      prev.year = year;
      prev.date = date;
    }
  }

  return Array.from(merged.values());
}

/**
 * @deprecated Kept as a thin alias for existing callers; the pipeline uses
 * `fetchArtistReleases` which returns the full record-type-classified list.
 */
export async function fetchArtistAlbums(qid: string): Promise<WikidataRelease[]> {
  return fetchArtistReleases(qid);
}
export type WikidataAlbum = WikidataRelease;

/**
 * Fetch the artist's direct P136 (genre) values. Direct labels only — we
 * don't walk P279 subclass chains, they explode the count into dozens.
 */
export async function fetchArtistGenres(qid: string): Promise<string[]> {
  const q = `
    SELECT DISTINCT ?gLabel WHERE {
      wd:${qid} wdt:P136 ?g .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;
  const r = await sparql(q, 5000);
  const rows = r?.results?.bindings ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const label = (row.gLabel?.value ?? '').toLowerCase().trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
