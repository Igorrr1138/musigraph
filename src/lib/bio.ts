/**
 * Artist biography loader — Last.fm only.
 *
 * Fetches `artist.getInfo`, strips the HTML, and returns the bio content.
 * (Previously fell back to Wikipedia via Wikidata QID — that path has
 * been removed as part of the migration to MusicBrainz.)
 */

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';

export interface ArtistBio {
  text: string;
  source: 'lastfm';
  url?: string;
}

function stripHtml(s: string): string {
  return s
    .replace(/<a[^>]*>Read more on Last\.fm<\/a>\.?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function getArtistBio(artistName: string): Promise<ArtistBio | null> {
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
