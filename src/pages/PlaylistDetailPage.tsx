import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Disc3,
  ListMusic,
  Music,
  PlayCircle,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import { Header } from "@/components/layout/Header";
import { PlaylistPickerDialog } from "@/components/music/PlaylistPickerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTO_PLAYLIST_ID,
  isAutoPlaylistId,
  type PlaylistTrackInput,
} from "@/lib/playlists";
import {
  getRelease,
  searchArtists,
  searchArtistsByTag,
  searchRecordings,
  searchReleases,
  type MusicBrainzArtist,
  type MusicBrainzRecording,
  type MusicBrainzRelease,
} from "@/lib/musicbrainz";
import { cn } from "@/lib/utils";

interface PlaylistViewTrack {
  id: string;
  trackMbid?: string | null;
  trackTitle: string;
  trackPosition?: number | null;
  albumMbid?: string | null;
  albumTitle?: string | null;
  artistName?: string | null;
  durationMs?: number | null;
  rating?: number | null;
}

const PlaylistDetailPage = () => {
  const { playlistId = AUTO_PLAYLIST_ID } = useParams<{ playlistId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playlists, addTrackToPlaylist } = usePlaylists();
  const { playTrack, currentTrack } = useYouTubePlayer();
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");
  const [tracks, setTracks] = useState<PlaylistViewTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTab, setSearchTab] = useState<"tracks" | "albums" | "artists">("tracks");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [trackResults, setTrackResults] = useState<MusicBrainzRecording[]>([]);
  const [albumResults, setAlbumResults] = useState<MusicBrainzRelease[]>([]);
  const [artistResults, setArtistResults] = useState<MusicBrainzArtist[]>([]);
  const [albumTrackResults, setAlbumTrackResults] = useState<Record<string, PlaylistViewTrack[]>>({});
  const [relatedArtists, setRelatedArtists] = useState<Record<string, MusicBrainzArtist[]>>({});
  const [pickerTrack, setPickerTrack] = useState<PlaylistTrackInput | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  const isAutoPlaylist = isAutoPlaylistId(playlistId);

  const loadCustomPlaylist = useCallback(async () => {
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .maybeSingle();

    if (playlistError) throw playlistError;
    if (!playlist) throw new Error("Playlist not found");

    setPlaylistName(playlist.name);
    setPlaylistDescription(playlist.description ?? "");

    const { data: items, error: itemsError } = await supabase
      .from("playlist_tracks")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("added_at", { ascending: false });

    if (itemsError) throw itemsError;

    setTracks(
      (items ?? []).map((item) => ({
        id: item.id,
        trackMbid: item.track_mbid,
        trackTitle: item.track_title,
        trackPosition: item.track_position,
        albumMbid: item.album_mbid,
        albumTitle: item.album_title,
        artistName: item.artist_name,
        durationMs: item.duration_ms,
      })),
    );
  }, [playlistId]);

  const loadAutoPlaylist = useCallback(async () => {
    if (!user) return;

    setPlaylistName("Top Rated Tracks");
    setPlaylistDescription("Auto-generated from every song you rated 8 or above.");

    const { data, error } = await supabase
      .from("track_ratings")
      .select("*")
      .eq("user_id", user.id)
      .gte("rating", 8)
      .order("rating", { ascending: false })
      .order("rated_at", { ascending: false });

    if (error) throw error;

    setTracks(
      (data ?? []).map((item) => ({
        id: item.id,
        trackMbid: item.track_mbid,
        trackTitle: item.track_title,
        trackPosition: item.track_position,
        albumMbid: item.album_mbid,
        albumTitle: item.album_title,
        artistName: item.artist_name,
        durationMs: item.duration_ms,
        rating: item.rating,
      })),
    );
  }, [user]);

  const refreshPlaylist = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      if (isAutoPlaylist) {
        await loadAutoPlaylist();
      } else {
        await loadCustomPlaylist();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not load playlist",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAutoPlaylist, loadAutoPlaylist, loadCustomPlaylist, toast, user]);

  useEffect(() => {
    void refreshPlaylist();
  }, [refreshPlaylist]);

  const playPlaylistTrack = (track: PlaylistViewTrack) => {
    const queue = tracks.map((entry) => ({
      id: entry.trackMbid || entry.id,
      title: entry.trackTitle,
      position: entry.trackPosition || 0,
      length: entry.durationMs ?? undefined,
    }));

    playTrack(
      {
        id: track.trackMbid || track.id,
        title: track.trackTitle,
        position: track.trackPosition || 0,
        length: track.durationMs ?? undefined,
      },
      track.albumMbid,
      track.artistName,
      track.albumTitle,
      queue,
    );
  };

  const removeTrack = async (trackId: string) => {
    try {
      const { error } = await supabase.from("playlist_tracks").delete().eq("id", trackId);
      if (error) throw error;
      await refreshPlaylist();
      toast({
        title: "Track removed",
        description: "The track was removed from your playlist.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not remove track",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);

      if (searchTab === "tracks") {
        const results = await searchRecordings(searchQuery.trim(), 8);
        setTrackResults(results);
        return;
      }

      if (searchTab === "albums") {
        const results = await searchReleases(searchQuery.trim(), 6);
        setAlbumResults(results);
        return;
      }

      const results = await searchArtists(searchQuery.trim(), 6);
      setArtistResults(results);
    } catch (error) {
      console.error(error);
      toast({
        title: "Search failed",
        description: "Please try a different query.",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const browseAlbumTracks = async (release: MusicBrainzRelease) => {
    if (albumTrackResults[release.id]) return;

    try {
      const fullRelease = await getRelease(release.id);
      const releaseTracks =
        fullRelease?.media?.[0]?.tracks?.map((track) => ({
          id: track.id,
          trackMbid: track.id,
          trackTitle: track.title,
          trackPosition: track.position,
          albumMbid: release["release-group"]?.id || release.id,
          albumTitle: release.title,
          artistName: release["artist-credit"]?.[0]?.artist.name,
          durationMs: track.length ?? null,
        })) ?? [];

      setAlbumTrackResults((current) => ({
        ...current,
        [release.id]: releaseTracks,
      }));
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not load album tracks",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const fetchRelatedArtists = async (artist: MusicBrainzArtist) => {
    const topTag = [...(artist.tags ?? [])].sort((left, right) => right.count - left.count)[0]?.name;
    if (!topTag || relatedArtists[artist.id]) return;

    try {
      const related = await searchArtistsByTag(topTag, 5);
      setRelatedArtists((current) => ({
        ...current,
        [artist.id]: related.filter((entry) => entry.id !== artist.id),
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const addTrackFromSearch = async (track: PlaylistTrackInput) => {
    if (isAutoPlaylist) {
      setPickerTrack(track);
      return;
    }

    try {
      await addTrackToPlaylist(playlistId, track);
      await refreshPlaylist();
      toast({
        title: "Track added",
        description: `"${track.trackTitle}" was added to ${playlistName}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not add track",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const topTrack = useMemo(() => tracks[0], [tracks]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="px-4 pt-24">
        <div className="container mx-auto max-w-6xl">
          <Link
            to="/playlists"
            className="mb-8 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to playlists
          </Link>

          <div className="mb-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary">
                {isAutoPlaylist ? "Smart playlist" : "Custom playlist"}
              </div>
              <h1 className="mt-4 text-4xl font-bold">{playlistName}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {playlistDescription || "A hand-picked collection of tracks for this mood."}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tracks</p>
                  <p className="mt-1 text-3xl font-bold text-primary">{tracks.length}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top track</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">{topTrack?.trackTitle || "—"}</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mode</p>
                  <p className="mt-1 text-sm font-medium">
                    {isAutoPlaylist ? "Auto 8+" : "Manual add & edit"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary">
                <Search className="h-3.5 w-3.5" />
                Search like Spotify
              </div>

              <h2 className="mt-4 text-2xl font-semibold">
                {isAutoPlaylist ? "Send tracks to another playlist" : "Find tracks to add"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search tracks directly, dive into albums, or pivot through artists and their
                genre-adjacent scene.
              </p>

              <div className="mt-5 flex gap-3">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tracks, albums, artists"
                />
                <Button
                  type="button"
                  onClick={() => void runSearch()}
                  className="gradient-bg border-0 text-primary-foreground"
                  disabled={!searchQuery.trim() || searchLoading}
                >
                  Search
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <div className="mb-4 flex items-center gap-2">
                <ListMusic className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-semibold">Tracks</h2>
              </div>

              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">Loading playlist...</div>
              ) : tracks.length ? (
                <div className="space-y-3">
                  {tracks.map((track) => {
                    const isPlaying =
                      currentTrack?.title === track.trackTitle &&
                      currentTrack?.position === (track.trackPosition || 0);

                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "rounded-2xl border border-border/50 bg-background/50 p-4",
                          isPlaying && "border-primary/40 bg-primary/5",
                        )}
                      >
                        <div className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => playPlaylistTrack(track)}
                            className="mt-1 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <PlayCircle
                              className={cn(
                                "h-6 w-6",
                                isPlaying && "fill-primary/20 text-primary",
                              )}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-lg font-medium">{track.trackTitle}</p>
                              {track.rating ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                                  <Star className="h-3.5 w-3.5 fill-primary" />
                                  {track.rating}/10
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              {track.artistName ? <span>{track.artistName}</span> : null}
                              {track.albumTitle ? <span>• {track.albumTitle}</span> : null}
                              {track.trackPosition ? <span>• Track {track.trackPosition}</span> : null}
                            </div>
                          </div>

                          {!isAutoPlaylist ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => void removeTrack(track.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="rounded-full"
                              onClick={() =>
                                setPickerTrack({
                                  trackMbid: track.trackMbid,
                                  trackTitle: track.trackTitle,
                                  trackPosition: track.trackPosition,
                                  albumMbid: track.albumMbid,
                                  albumTitle: track.albumTitle,
                                  artistName: track.artistName,
                                  durationMs: track.durationMs,
                                })
                              }
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-background/40 px-6 py-16 text-center">
                  <p className="text-lg font-medium">No tracks here yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Use the search panel to start filling this playlist.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <Tabs value={searchTab} onValueChange={(value) => setSearchTab(value as typeof searchTab)}>
                <TabsList className="grid w-full grid-cols-3 bg-background/60">
                  <TabsTrigger value="tracks">Tracks</TabsTrigger>
                  <TabsTrigger value="albums">Albums</TabsTrigger>
                  <TabsTrigger value="artists">Artists</TabsTrigger>
                </TabsList>

                <TabsContent value="tracks" className="mt-5 space-y-3">
                  {trackResults.map((track) => {
                    const release = track.releases?.[0];
                    const artist = track["artist-credit"]?.[0]?.artist?.name;

                    return (
                      <div key={track.id} className="rounded-2xl border border-border/50 bg-background/50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-medium">{track.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {artist || "Unknown artist"}
                              {release?.title ? ` • ${release.title}` : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="gradient-bg border-0 text-primary-foreground"
                            onClick={() =>
                              void addTrackFromSearch({
                                trackMbid: track.id,
                                trackTitle: track.title,
                                albumMbid: release?.["release-group"]?.id || release?.id || null,
                                albumTitle: release?.title || null,
                                artistName: artist || null,
                                durationMs: track.length ?? null,
                              })
                            }
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="albums" className="mt-5 space-y-3">
                  {albumResults.map((album) => (
                    <div key={album.id} className="rounded-2xl border border-border/50 bg-background/50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-medium">{album.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {album["artist-credit"]?.[0]?.artist.name || "Unknown artist"}
                            {album.date ? ` • ${album.date}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void browseAlbumTracks(album)}
                        >
                          Browse tracks
                        </Button>
                      </div>

                      {albumTrackResults[album.id]?.length ? (
                        <div className="mt-4 grid gap-2 rounded-2xl border border-border/50 bg-card/50 p-3">
                          {albumTrackResults[album.id].map((track) => (
                            <div
                              key={`${album.id}-${track.trackPosition}-${track.trackTitle}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{track.trackTitle}</p>
                                <p className="text-xs text-muted-foreground">
                                  Track {track.trackPosition}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="gradient-bg border-0 text-primary-foreground"
                                onClick={() => void addTrackFromSearch(track)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="artists" className="mt-5 space-y-3">
                  {artistResults.map((artist) => {
                    const topTag = [...(artist.tags ?? [])].sort((left, right) => right.count - left.count)[0]?.name;

                    return (
                      <div key={artist.id} className="rounded-2xl border border-border/50 bg-background/50 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              <p className="truncate text-lg font-medium">{artist.name}</p>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {artist.disambiguation || topTag || "Artist result"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setSearchTab("albums");
                                setSearchQuery(artist.name);
                                void searchReleases(artist.name, 6).then(setAlbumResults);
                              }}
                            >
                              Browse releases
                            </Button>
                            {topTag ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void fetchRelatedArtists(artist)}
                              >
                                Similar by genre
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {relatedArtists[artist.id]?.length ? (
                          <div className="mt-4 rounded-2xl border border-border/50 bg-card/50 p-3">
                            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                              Genre-adjacent artists
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {relatedArtists[artist.id].map((relatedArtist) => (
                                <button
                                  key={relatedArtist.id}
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery(relatedArtist.name);
                                    setSearchTab("albums");
                                    void searchReleases(relatedArtist.name, 6).then(setAlbumResults);
                                  }}
                                  className="rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                                >
                                  {relatedArtist.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      <PlaylistPickerDialog
        open={Boolean(pickerTrack)}
        onOpenChange={(open) => {
          if (!open) setPickerTrack(null);
        }}
        track={pickerTrack}
      />
    </div>
  );
};

export default PlaylistDetailPage;
