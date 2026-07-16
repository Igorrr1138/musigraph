/**
 * Artist biography loader — Last.fm (primary), Wikidata → Wikipedia (fallback).
 *
 * 1. Try Last.fm's `artist.getInfo` (bio.content, HTML — we strip tags).
 * 2. If Last.fm has nothing usable AND we have a Wikidata QID, resolve the
 *    English Wikipedia sitelink via SPARQL and fetch the REST summary.
 */

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';

export interface ArtistBio {
  text: string;
  source: 'wikipedia' | 'lastfm';
  url?: string;
}

async function fetchWikipediaBio(qid: string): Promise<ArtistBio | null> {
  try {
    // Resolve the enwiki sitelink title for this QID.
    const sparql = `SELECT ?title WHERE {
      ?article schema:about wd:${qid} ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?title .
    } LIMIT 1`;
    const sr = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
      { headers: { Accept: 'application/sparql-results+json' } },
    );
    if (!sr.ok) return null;
    const sj = (await sr.json()) as {
      results?: { bindings?: Array<{ title?: { value: string } }> };
    };
    const title = sj.results?.bindings?.[0]?.title?.value;
    if (!title) return null;

    const wr = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!wr.ok) return null;
    const wj = (await wr.json()) as {
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const text = (wj.extract ?? '').trim();
    if (!text) return null;
    return {
      text,
      source: 'wikipedia',
      url: wj.content_urls?.desktop?.page,
    };
  } catch {
    return null;
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<a[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchLastfmBio(artistName: string): Promise<ArtistBio | null> {
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as {
      artist?: { bio?: { content?: string; summary?: string }; url?: string };
    };
    const raw = j.artist?.bio?.content ?? j.artist?.bio?.summary ?? '';
    const text = stripHtml(raw);
    if (!text) return null;
    return { text, source: 'lastfm', url: j.artist?.url };
  } catch {
    return null;
  }
}

export async function getArtistBio(
  artistName: string,
  qid: string | null,
): Promise<ArtistBio | null> {
  const lf = await fetchLastfmBio(artistName);
  if (lf && lf.text.length >= 40) return lf;
  if (qid) {
    const wp = await fetchWikipediaBio(qid);
    if (wp) return wp;
  }
  return lf;
}
