import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export interface PlaylistTrackInput {
  trackMbid?: string | null;
  trackTitle: string;
  trackPosition?: number | null;
  albumMbid?: string | null;
  albumTitle?: string | null;
  artistName?: string | null;
  durationMs?: number | null;
}

export type PlaylistSummary = Tables<"playlists">;
export type PlaylistTrack = Tables<"playlist_tracks">;

export const AUTO_PLAYLIST_ID = "top-rated";

export function buildPlaylistTrackKey(track: PlaylistTrackInput) {
  return [
    track.trackMbid?.trim() || "no-mbid",
    track.albumMbid?.trim() || "no-album",
    track.trackPosition ?? "0",
    track.trackTitle.trim().toLowerCase(),
  ].join("::");
}

export function buildPlaylistTrackInsert(
  playlistId: string,
  track: PlaylistTrackInput,
): TablesInsert<"playlist_tracks"> {
  return {
    playlist_id: playlistId,
    track_key: buildPlaylistTrackKey(track),
    track_mbid: track.trackMbid ?? null,
    track_title: track.trackTitle,
    track_position: track.trackPosition ?? null,
    album_mbid: track.albumMbid ?? null,
    album_title: track.albumTitle ?? null,
    artist_name: track.artistName ?? null,
    duration_ms: track.durationMs ?? null,
  };
}

export function isAutoPlaylistId(playlistId: string) {
  return playlistId === AUTO_PLAYLIST_ID;
}
