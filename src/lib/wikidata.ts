/**
 * Wikidata SPARQL client — primary source for historical release chronology
 * (P577 "publication date") and artist genre hierarchy (P136 "genre").
 *
 * We resolve the artist QID first via the Deezer-ID property (P2722), then
 * fall back to the Wikidata search API (wbsearchentities). All requests are
 * bounded by a short timeout and any failure returns null/[] so the pipeline
 * can gracefully fall back to Deezer/Last.fm data.
 *
 * Nothing here is persisted directly — the orchestrator in `musicPipeline.ts`
 * caches the merged payload in the `music_cache` Supabase table.
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
 * Resolve the Wikidata QID for a Deezer artist. Primary path uses
 * `P2722` (Deezer artist ID). Fallback uses the search API filtered to items
 * whose description mentions a music-related occupation. Returns null when
 * both paths fail.
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

export interface WikidataAlbum {
  qid: string;
  title: string;
  /** ISO date (YYYY-MM-DD) — earliest known P577. */
  date?: string;
  year?: number;
}

/**
 * Fetch every release the artist performed on (P175), constrained to items
 * that are transitively an "album" (Q482994) — this includes studio albums,
 * EPs, and live albums via P279 subclass chains. Returns the *earliest*
 * P577 date per album, which is the "historical" original release year.
 */
export async function fetchArtistAlbums(qid: string): Promise<WikidataAlbum[]> {
  const q = `
    SELECT ?album ?albumLabel (MIN(?date) AS ?first) WHERE {
      ?album wdt:P175 wd:${qid} ;
             wdt:P31/wdt:P279* wd:Q482994 .
      OPTIONAL { ?album wdt:P577 ?date . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,es". }
    } GROUP BY ?album ?albumLabel
  `;
  const r = await sparql(q);
  const rows = r?.results?.bindings ?? [];
  const out: WikidataAlbum[] = [];
  for (const row of rows) {
    const uri = row.album?.value ?? '';
    const albumQid = uri.split('/').pop() ?? '';
    const title = row.albumLabel?.value ?? '';
    if (!albumQid || !title) continue;
    const rawDate = row.first?.value;
    const date = rawDate?.slice(0, 10);
    const yearNum = date ? parseInt(date.slice(0, 4), 10) : NaN;
    out.push({
      qid: albumQid,
      title,
      date,
      year: Number.isFinite(yearNum) ? yearNum : undefined,
    });
  }
  return out;
}

/**
 * Fetch the artist's direct P136 (genre) values. We deliberately do not walk
 * the full P279 subclass hierarchy here — the direct labels are already the
 * canonical parent genre (e.g. "heavy metal", "thrash metal"), and expanding
 * the hierarchy would blow the badge count into the dozens.
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
