import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPlaylistTrackInsert,
  type PlaylistSummary,
  type PlaylistTrackInput,
} from "@/lib/playlists";

export function usePlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      setIsLoading(false);
      throw error;
    }

    setPlaylists(data ?? []);
    setIsLoading(false);
    return data ?? [];
  }, [user]);

  useEffect(() => {
    void refreshPlaylists().catch(() => {
      setIsLoading(false);
    });
  }, [refreshPlaylists]);

  const createPlaylist = useCallback(
    async (name: string, description?: string) => {
      if (!user) throw new Error("Authentication required");

      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Playlist name is required");

      const { data, error } = await supabase
        .from("playlists")
        .insert({
          user_id: user.id,
          name: trimmedName,
          description: description?.trim() || null,
        })
        .select("*")
        .single();

      if (error) throw error;

      await refreshPlaylists();
      return data;
    },
    [refreshPlaylists, user],
  );

  const addTrackToPlaylist = useCallback(
    async (playlistId: string, track: PlaylistTrackInput) => {
      const insert = buildPlaylistTrackInsert(playlistId, track);
      const { error } = await supabase.from("playlist_tracks").upsert(insert, {
        onConflict: "playlist_id,track_key",
      });

      if (error) throw error;

      await supabase
        .from("playlists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", playlistId);
    },
    [],
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const { error } = await supabase.from("playlists").delete().eq("id", playlistId);
      if (error) throw error;
      await refreshPlaylists();
    },
    [refreshPlaylists],
  );

  return {
    playlists,
    isLoading,
    refreshPlaylists,
    createPlaylist,
    addTrackToPlaylist,
    deletePlaylist,
  };
}
