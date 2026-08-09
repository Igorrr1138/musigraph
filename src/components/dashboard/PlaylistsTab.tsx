import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Music, Sparkles, ListMusic, Trash2 } from '@/components/icons';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';


interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  trackCount: number;
}

export function PlaylistsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [autoCount, setAutoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: pls }, { count }] = await Promise.all([
      supabase
        .from('playlists')
        .select('id,name,description,cover_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('track_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('rating', 8),
    ]);

    const ids = (pls ?? []).map((p) => p.id);
    let countsMap = new Map<string, number>();
    if (ids.length) {
      const { data: tracks } = await supabase
        .from('playlist_tracks')
        .select('playlist_id')
        .in('playlist_id', ids);
      (tracks ?? []).forEach((t) => {
        countsMap.set(t.playlist_id, (countsMap.get(t.playlist_id) ?? 0) + 1);
      });
    }

    setPlaylists(
      (pls ?? []).map((p) => ({ ...p, trackCount: countsMap.get(p.id) ?? 0 })),
    );
    setAutoCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    const { error } = await supabase.from('playlists').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-boldonse mb-3">Playlists</h1>
        <p className="text-muted-foreground max-w-2xl">
          Build custom playlists from any track, album or artist result, and keep a smart shelf of
          everything you rated 8+
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-3">
          {/* Auto-generated Top Rated Tracks */}
          <Link
            to="/dashboard/playlists/auto-top-rated"
            className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-card/60 p-4 hover:border-primary/50 transition-all"
          >
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                Top Rated Tracks
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                Auto-generated from every song you rated 8 or above.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Music className="w-4 h-4" />
              {autoCount} track{autoCount === 1 ? '' : 's'}
            </div>
          </Link>

          {playlists.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 hover:border-primary/50 transition-all"
            >
              <Link
                to={`/dashboard/playlists/${p.id}`}
                className="flex items-center gap-4 flex-1 min-w-0"
              >
                <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {p.cover_url ? (
                    <img src={p.cover_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ListMusic className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground truncate">{p.description}</p>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <Music className="w-4 h-4" />
                  {p.trackCount} track{p.trackCount === 1 ? '' : 's'}
                </div>
              </Link>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Delete playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <Link
            to="/dashboard/playlists/new"
            className="flex items-center gap-4 rounded-2xl border border-dashed border-border/60 bg-card/20 p-4 hover:border-primary/50 hover:bg-card/40 transition-all"
          >
            <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
              <Plus className="w-7 h-7 text-muted-foreground" />
            </div>
            <span className="text-lg font-semibold">Add playlist…</span>
          </Link>
        </div>
      )}
    </div>
  );
}
