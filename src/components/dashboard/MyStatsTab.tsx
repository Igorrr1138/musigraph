import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Star,
  Music,
  Disc3,
  TrendingUp,
  Headphones,
  Calendar,
  ImageOff,
} from '@/components/icons';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartPanel,
  TooltipShell,
  chartPalette,
  getBrandRatingColor,
} from '@/components/charts/brand-charts';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { categoryForTag } from '@/lib/genreMap';

interface AlbumRating {
  id: string;
  album_deezer_id: string | null;
  artist_deezer_id: string | null;
  album_title: string;
  artist_name: string | null;
  cover_url: string | null;
  rating: number;
  rated_at: string;
}

interface TrackRating {
  id: string;
  track_title: string;
  rating: number;
  rated_at: string;
  album_deezer_id: string | null;
}

interface GenreSlice {
  name: string;
  value: number;
  percent: number;
}

const RANGES = [
  { id: '1M', label: '1M', days: 30 },
  { id: '3M', label: '3M', days: 90 },
  { id: '6M', label: '6M', days: 180 },
  { id: 'YTD', label: 'YTD', days: -1 },
  { id: '1Y', label: '1Y', days: 365 },
  { id: 'MAX', label: 'MAX', days: 0 },
] as const;

type RangeId = (typeof RANGES)[number]['id'];

const GENRE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--gradient-start))',
  'hsl(var(--gradient-end))',
  'hsl(var(--accent))',
  'hsl(20 80% 45%)',
  'hsl(0 60% 38%)',
  'hsl(30 50% 60%)',
  'hsl(10 40% 30%)',
  'hsl(0 0% 55%)',
  'hsl(0 0% 38%)',
  'hsl(0 0% 25%)',
  'hsl(0 0% 18%)',
];

export function MyStatsTab() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<AlbumRating[]>([]);
  const [tracks, setTracks] = useState<TrackRating[]>([]);
  const [genres, setGenres] = useState<GenreSlice[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeId>('MAX');
  const gradientId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: a }, { data: t }] = await Promise.all([
        supabase
          .from('album_ratings')
          .select('id,album_deezer_id,artist_deezer_id,album_title,artist_name,cover_url,rating,rated_at')
          .eq('user_id', user.id)
          .order('rated_at', { ascending: true }),
        supabase
          .from('track_ratings')
          .select('id,track_title,rating,rated_at,album_deezer_id')
          .eq('user_id', user.id),
      ]);
      if (cancelled) return;
      const albumList = (a ?? []) as AlbumRating[];
      setAlbums(albumList);
      setTracks((t ?? []) as TrackRating[]);

      // Genre breakdown from cached artist tags is disabled during the
      // MusicBrainz migration (artists_cache was dropped). Will be
      // reintroduced via MB genres in a follow-up pass.
      setGenres([]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredAlbums = useMemo(() => {
    if (range === 'MAX') return albums;
    const now = Date.now();
    if (range === 'YTD') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
      return albums.filter(a => new Date(a.rated_at).getTime() >= startOfYear);
    }
    const days = RANGES.find(r => r.id === range)?.days ?? 0;
    if (!days) return albums;
    const cutoff = now - days * 86400000;
    return albums.filter(a => new Date(a.rated_at).getTime() >= cutoff);
  }, [albums, range]);

  const chartData = useMemo(
    () =>
      filteredAlbums.map((r, i) => ({
        x: i + 1,
        y: r.rating,
        album: r.album_title,
        artist: r.artist_name ?? 'Unknown',
        cover: r.cover_url,
        date: new Date(r.rated_at).toLocaleDateString(),
      })),
    [filteredAlbums],
  );

  const avg = chartData.length
    ? chartData.reduce((s, p) => s + p.y, 0) / chartData.length
    : 0;

  const monthHighlights = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthAlbums = albums.filter(a => new Date(a.rated_at).getTime() >= cutoff);
    const monthTracks = tracks.filter(t => new Date(t.rated_at).getTime() >= cutoff);
    const albumOfMonth = monthAlbums.length
      ? [...monthAlbums].sort((a, b) => b.rating - a.rating)[0]
      : null;
    const songOfMonth = monthTracks.length
      ? [...monthTracks].sort((a, b) => b.rating - a.rating)[0]
      : null;
    return { albumOfMonth, songOfMonth };
  }, [albums, tracks]);

  const topListened = useMemo(
    () => [...albums].sort((a, b) => b.rating - a.rating).slice(0, 5),
    [albums],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Disc3 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl md:text-5xl font-boldonse mb-3">Rating graph</h1>
        <p className="text-muted-foreground">A branded arc of every album you have scored.</p>
      </header>

      {/* Score curve panel */}
      <ChartPanel>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-xl font-semibold">My score curve</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read it left to right as your listening timeline.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/60 p-1">
            {RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1 text-xs uppercase tracking-widest rounded-full transition-colors ${
                  range === r.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={380}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 18, left: -8 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartPalette.gradientStart} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={chartPalette.primary} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartPalette.grid} strokeDasharray="3 10" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[1, 'dataMax']}
                allowDecimals={false}
                tick={{ fill: chartPalette.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={12}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fill: chartPalette.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <ReferenceLine y={avg} stroke={chartPalette.gradientEnd} strokeDasharray="8 8" />
              <Tooltip
                cursor={{ stroke: chartPalette.primarySoft, strokeWidth: 1 }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <TooltipShell>
                      <div className="flex items-start gap-3">
                        {d.cover ? (
                          <img src={d.cover} alt="" className="w-14 h-14 rounded-lg object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center">
                            <ImageOff className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold line-clamp-1">{d.album}</p>
                          <p className="text-xs text-muted-foreground">{d.artist}</p>
                          <p className="mt-2 text-xs font-mono">{d.y}/10 · #{d.x}</p>
                          <p className="text-[10px] text-muted-foreground">{d.date}</p>
                        </div>
                      </div>
                    </TooltipShell>
                  );
                }}
              />
              <Area
                type="monotoneX"
                dataKey="y"
                stroke={chartPalette.primary}
                fill={`url(#${gradientId})`}
                strokeWidth={2.5}
                dot={({ cx, cy, payload }: any) => {
                  if (cx == null || cy == null) return null;
                  const tone = getBrandRatingColor(payload.y);
                  return <circle cx={cx} cy={cy} r={3} fill={tone} stroke="hsl(var(--background))" strokeWidth={1.25} />;
                }}
                activeDot={{ r: 6, fill: chartPalette.primary, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-20 text-center text-muted-foreground">
            No ratings in this range yet.
          </div>
        )}
      </ChartPanel>

      {/* Stat cards row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Disc3} label="Albums Rated" value={albums.length.toString()} />
        <StatCard icon={Music} label="Songs Rated" value={tracks.length.toString()} />
        <StatCard
          icon={Star}
          label="Average Rating"
          value={
            albums.length
              ? (albums.reduce((s, a) => s + a.rating, 0) / albums.length).toFixed(1)
              : '0'
          }
        />
      </div>

      {/* Stat cards row 2 - monthly highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HighlightCard
          icon={Music}
          tag="Song of the Month"
          title={monthHighlights.songOfMonth?.track_title ?? '—'}
          subtitle={monthHighlights.songOfMonth ? `${monthHighlights.songOfMonth.rating}/10` : 'No tracks rated this month'}
        />
        <HighlightCard
          icon={Disc3}
          tag="Album of the Month"
          title={monthHighlights.albumOfMonth?.album_title ?? '—'}
          subtitle={
            monthHighlights.albumOfMonth
              ? `by ${monthHighlights.albumOfMonth.artist_name ?? 'Unknown'} · ${monthHighlights.albumOfMonth.rating}/10`
              : 'No albums rated this month'
          }
        />
        <StatCard icon={Headphones} label="Total Streams" value={tracks.length.toString()} />
      </div>

      {/* Listened genres */}
      <section>
        <h2 className="text-3xl font-boldonse mb-5">Listened genres</h2>
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur-sm">
          {genres.length ? (
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-center">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genres}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={1.5}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {genres.map((_, i) => (
                        <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as GenreSlice;
                        return (
                          <TooltipShell className="min-w-[160px]">
                            <p className="text-sm font-semibold">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.percent.toFixed(1)}%</p>
                          </TooltipShell>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {genres.map((g, i) => (
                  <div key={g.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }}
                    />
                    <span className="text-foreground">{g.name}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{g.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-10 text-muted-foreground text-sm">
              Rate albums from a few artists to see your genre mix.
            </p>
          )}
        </div>
      </section>

      {/* Top Listened */}
      <section>
        <h2 className="text-3xl font-boldonse mb-5">Top Listened</h2>
        {topListened.length ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {topListened.map((album, i) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/album/${album.album_deezer_id}`}
                  className="block group rounded-xl border border-border/40 bg-card/40 p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="aspect-square rounded-lg bg-secondary overflow-hidden mb-3 flex items-center justify-center">
                    {album.cover_url ? (
                      <img
                        src={album.cover_url}
                        alt={album.album_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <ImageOff className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{album.album_title}</p>
                  <p className="text-xs text-muted-foreground truncate">{album.artist_name}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-10 text-center">
            <p className="text-muted-foreground mb-4">No albums yet — start rating to fill your top list.</p>
            <Link to="/">
              <Button className="gradient-bg text-primary-foreground border-0">Discover Music</Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
      <div className="text-3xl font-boldonse mb-2">{value}</div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  tag,
  title,
  subtitle,
}: {
  icon: typeof Star;
  tag: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-base font-semibold truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        </div>
        <Star className="w-4 h-4 text-primary fill-primary flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {tag}
      </div>
    </div>
  );
}
