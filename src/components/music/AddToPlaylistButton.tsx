import { useEffect, useState } from 'react';
import { Plus, Check, ListMusic, Sparkles, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { DeezerTrack } from '@/lib/deezer';

interface Props {
  track: DeezerTrack;
  artistName?: string;
  albumTitle?: string;
  albumDeezerId?: string;
  coverUrl?: string | null;
}

interface PlaylistRow {
  id: string;
  name: string;
  trackCount?: number;
}

export function AddToPlaylistButton({
  track,
  artistName,
  albumTitle,
  albumDeezerId,
  coverUrl,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [existsIn, setExistsIn] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Was this track already in any of the user's playlists at mount?
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('playlist_tracks')
      .select('playlist_id')
      .eq('user_id', user.id)
      .eq('track_deezer_id', String(track.id))
      .then(({ data }) => {
        if (cancelled) return;
        const set = new Set((data ?? []).map((r) => r.playlist_id));
        setExistsIn(set);
        if (set.size > 0) setAdded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, track.id]);

  const loadPlaylists = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('playlists')
      .select('id,name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPlaylists(data ?? []);
  };

  const openPicker = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to build playlists.',
        variant: 'destructive',
      });
      return;
    }
    setOpen(true);
    await loadPlaylists();
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!user) return;
    setBusy(true);
    const { count } = await supabase
      .from('playlist_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('playlist_id', playlistId);

    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      user_id: user.id,
      position: count ?? 0,
      track_deezer_id: String(track.id),
      track_title: track.title,
      artist_name: artistName ?? track.artist?.name ?? null,
      artist_deezer_id: track.artist?.id ? String(track.artist.id) : null,
      album_title: albumTitle ?? null,
      album_deezer_id: albumDeezerId ?? null,
      cover_url: coverUrl ?? null,
      duration_seconds: track.duration ?? null,
    });
    setBusy(false);

    if (error) {
      toast({ title: 'Could not add', description: error.message, variant: 'destructive' });
      return;
    }
    setExistsIn((prev) => new Set(prev).add(playlistId));
    setAdded(true);
    setOpen(false);
    toast({ title: 'Added to playlist', description: track.title });
  };

  const createAndAdd = async () => {
    if (!user || !newName.trim()) return;
    setBusy(true);
    const { data: pl, error } = await supabase
      .from('playlists')
      .insert({ user_id: user.id, name: newName.trim() })
      .select('id,name')
      .single();
    setBusy(false);
    if (error || !pl) {
      toast({ title: 'Could not create', description: error?.message, variant: 'destructive' });
      return;
    }
    setNewName('');
    setCreating(false);
    await addToPlaylist(pl.id);
  };

  return (
    <>
      <button
        onClick={openPicker}
        aria-label="Add to playlist"
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200',
          added
            ? 'border-primary/60 bg-primary/15 text-primary'
            : 'border-border text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5',
        )}
      >
        {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to playlist</DialogTitle>
            <DialogDescription className="truncate">{track.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-72 overflow-y-auto -mx-2 px-2">
            {playlists.length === 0 && !creating && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                You don't have any playlists yet.
              </div>
            )}
            {playlists.map((p) => {
              const has = existsIn.has(p.id);
              return (
                <button
                  key={p.id}
                  disabled={has || busy}
                  onClick={() => addToPlaylist(p.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                    has
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'hover:bg-secondary text-foreground',
                  )}
                >
                  <ListMusic className="w-4 h-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {has && <Check className="w-4 h-4" />}
                </button>
              );
            })}
          </div>

          {creating ? (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
                onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
              />
              <Button onClick={createAndAdd} disabled={busy || !newName.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create new playlist</span>
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
