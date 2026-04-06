import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ListMusic } from "lucide-react";

import { usePlaylists } from "@/hooks/usePlaylists";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { PlaylistTrackInput } from "@/lib/playlists";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface PlaylistPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: PlaylistTrackInput | null;
}

export function PlaylistPickerDialog({
  open,
  onOpenChange,
  track,
}: PlaylistPickerDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { playlists, isLoading, createPlaylist, addTrackToPlaylist } = usePlaylists();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogTitle = useMemo(() => {
    if (!track) return "Add to playlist";
    return `Add "${track.trackTitle}"`;
  }, [track]);

  const handleExistingPlaylistAdd = async (playlistId: string) => {
    if (!track) return;

    try {
      setIsSubmitting(true);
      await addTrackToPlaylist(playlistId, track);
      toast({
        title: "Added to playlist",
        description: `"${track.trackTitle}" is now in your playlist.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not add track",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!track || !newPlaylistName.trim()) return;

    try {
      setIsSubmitting(true);
      const playlist = await createPlaylist(newPlaylistName, newPlaylistDescription);
      await addTrackToPlaylist(playlist.id, track);
      toast({
        title: "Playlist created",
        description: `"${track.trackTitle}" was added to ${playlist.name}.`,
      });
      setNewPlaylistName("");
      setNewPlaylistDescription("");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not create playlist",
        description: "Please check the playlist name and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/70 bg-card/95 p-0 text-foreground backdrop-blur-xl">
        <div className="rounded-[26px] border border-white/5 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_28%),linear-gradient(180deg,hsl(var(--card)),hsl(var(--background)))] p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{dialogTitle}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Send this track to an existing playlist or spin up a new one without
              leaving the album page.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="mt-6 rounded-2xl border border-border/60 bg-background/50 p-5">
              <p className="text-sm text-muted-foreground">
                Sign in to create playlists and start building your song library.
              </p>
              <Button asChild className="mt-4 gradient-bg text-primary-foreground border-0">
                <Link to="/auth">Go to Sign In</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Existing Playlists
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      One tap to drop this song into a live playlist.
                    </p>
                  </div>
                  <ListMusic className="h-4 w-4 text-primary" />
                </div>

                <div className="grid gap-3">
                  {playlists.length ? (
                    playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        type="button"
                        disabled={isLoading || isSubmitting}
                        onClick={() => void handleExistingPlaylistAdd(playlist.id)}
                        className="flex items-center justify-between rounded-xl border border-border/50 bg-card/70 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{playlist.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {playlist.description || "Custom playlist"}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-primary" />
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-sm text-muted-foreground">
                      No playlists yet. Create your first one on the right.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  New Playlist
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <Input
                      value={newPlaylistName}
                      onChange={(event) => setNewPlaylistName(event.target.value)}
                      placeholder="Late Night Heavy Rotation"
                    />
                  </div>
                  <div>
                    <Textarea
                      value={newPlaylistDescription}
                      onChange={(event) => setNewPlaylistDescription(event.target.value)}
                      placeholder="Optional note about this playlist"
                      className="min-h-[120px]"
                    />
                  </div>

                  <Button
                    type="button"
                    disabled={!newPlaylistName.trim() || isSubmitting}
                    onClick={() => void handleCreateAndAdd()}
                    className="w-full gradient-bg text-primary-foreground border-0"
                  >
                    Create Playlist and Add Track
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
