import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ListMusic, Plus, Sparkles } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AUTO_PLAYLIST_ID } from "@/lib/playlists";

const PlaylistsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playlists, isLoading, createPlaylist } = usePlaylists();
  const [playlistTrackCounts, setPlaylistTrackCounts] = useState<Record<string, number>>({});
  const [topRatedCount, setTopRatedCount] = useState(0);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;

      const [{ data: playlistItems }, { count }] = await Promise.all([
        supabase.from("playlist_tracks").select("playlist_id"),
        supabase
          .from("track_ratings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("rating", 8),
      ]);

      const counts = (playlistItems ?? []).reduce<Record<string, number>>((map, item) => {
        map[item.playlist_id] = (map[item.playlist_id] ?? 0) + 1;
        return map;
      }, {});

      setPlaylistTrackCounts(counts);
      setTopRatedCount(count ?? 0);
    };

    void fetchCounts();
  }, [playlists, user]);

  const totalTracks = useMemo(
    () => Object.values(playlistTrackCounts).reduce((sum, value) => sum + value, 0),
    [playlistTrackCounts],
  );

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      setIsCreating(true);
      const playlist = await createPlaylist(newPlaylistName, newPlaylistDescription);
      toast({
        title: "Playlist created",
        description: `${playlist.name} is ready for songs.`,
      });
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      navigate(`/playlists/${playlist.id}`);
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not create playlist",
        description: "Please try a different name or try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

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
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to discover
          </Link>

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Playlists</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Build custom playlists from any track, album or artist result, and keep a
                smart shelf of everything you rated 8+.
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/70 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Library
              </p>
              <p className="mt-2 text-2xl font-bold text-primary">{playlists.length}</p>
              <p className="text-sm text-muted-foreground">{totalTracks} saved tracks</p>
            </div>
          </div>

          <div className="mb-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-4 w-4" />
                Smart playlist
              </div>
              <h2 className="mt-4 text-2xl font-semibold">Top Rated Tracks</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Auto-generated from every song you rated 8 or above.
              </p>

              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4">
                <p className="text-sm text-muted-foreground">Eligible tracks</p>
                <p className="mt-1 text-3xl font-bold text-primary">{topRatedCount}</p>
              </div>

              <Button asChild className="mt-5 gradient-bg border-0 text-primary-foreground">
                <Link to={`/playlists/${AUTO_PLAYLIST_ID}`}>Open smart playlist</Link>
              </Button>
            </div>

            <div className="rounded-[28px] border border-border/60 bg-card/70 p-6">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary">
                <Plus className="h-4 w-4" />
                New playlist
              </div>
              <h2 className="mt-4 text-2xl font-semibold">Create a custom collection</h2>
              <div className="mt-5 space-y-4">
                <Input
                  value={newPlaylistName}
                  onChange={(event) => setNewPlaylistName(event.target.value)}
                  placeholder="Sunday haze"
                />
                <Textarea
                  value={newPlaylistDescription}
                  onChange={(event) => setNewPlaylistDescription(event.target.value)}
                  placeholder="What kind of energy should live in this playlist?"
                  className="min-h-[120px]"
                />
                <Button
                  type="button"
                  disabled={!newPlaylistName.trim() || isCreating}
                  onClick={() => void handleCreatePlaylist()}
                  className="gradient-bg border-0 text-primary-foreground"
                >
                  Create playlist
                </Button>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center gap-2">
              <ListMusic className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold">Custom playlists</h2>
            </div>

            {isLoading ? (
              <div className="rounded-2xl border border-border/50 bg-card/50 px-6 py-16 text-center text-muted-foreground">
                Loading playlists...
              </div>
            ) : playlists.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {playlists.map((playlist, index) => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: index * 0.05 }}
                  >
                    <Link
                      to={`/playlists/${playlist.id}`}
                      className="block rounded-[24px] border border-border/50 bg-card/70 p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary">
                        Custom
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold">{playlist.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {playlist.description || "No description yet. Add tracks and shape its identity later."}
                      </p>
                      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
                        <span>{playlistTrackCounts[playlist.id] ?? 0} tracks</span>
                        <span>Open playlist →</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/50 bg-card/50 px-6 py-16 text-center">
                <p className="text-lg font-medium">No custom playlists yet</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first playlist above, then use the + button on any track.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistsPage;
