/**
 * Metadata Cleaning Utility
 * Strips common YouTube suffixes and junk from track/artist names.
 */

// Patterns to remove from titles
const JUNK_PATTERNS = [
  // Bracketed content with common YouTube suffixes
  /\s*[\(\[]\s*(official\s*(music\s*)?video|official\s*audio|official\s*lyric\s*video|lyric\s*video|lyrics?\s*video|music\s*video|visuali[sz]er|animated\s*video|live\s*video|audio\s*only|audio|hd|4k|uhd|1080p|720p|remaster(ed)?|deluxe(\s*edition)?|bonus\s*track|explicit|clean\s*version)\s*[\)\]]/gi,
  // feat./ft./featuring in brackets
  /\s*[\(\[]\s*(feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]/gi,
  // feat./ft./featuring without brackets (at end of string)
  /\s*[-–—]\s*(feat\.?|ft\.?|featuring)\s+.+$/gi,
  // Empty brackets leftover
  /\s*[\(\[]\s*[\)\]]/g,
  // Trailing dashes with nothing meaningful
  /\s*[-–—]\s*$/g,
];

/**
 * Clean a track or artist name by removing YouTube junk suffixes.
 */
export function cleanTrackTitle(title: string): string {
  let cleaned = title;
  for (const pattern of JUNK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Trim extra whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

/**
 * Clean a search query for better YouTube API accuracy.
 * More aggressive: removes ALL bracketed content.
 */
export function cleanSearchQuery(title: string): string {
  let cleaned = title;
  // Remove all content in brackets/parens
  cleaned = cleaned.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '');
  // Remove feat/ft
  cleaned = cleaned.replace(/\s*[-–—]?\s*(feat\.?|ft\.?|featuring)\s+.+$/gi, '');
  // Trim
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}
