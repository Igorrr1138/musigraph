import { useState, useEffect, useMemo, useId } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Disc3, User, Users, ArrowLeft } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartPanel,
  LegendPills,
  TooltipShell,
  chartPalette,
} from '@/components/charts/brand-charts';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useArtistImage } from '@/hooks/useArtistImage';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AlbumRating {
  album_deezer_id: string;
  album_title: string;
  rating: number;
  rated_at: string;
  cover_url: string | null;
  release_date: string | null;
}

interface TrackRating {
  track_position: number;
  track_title: string;
  rating: number;
}

interface CommunityAlbumAvg {
  album_deezer_id: string;
  avg_rating: number;
  rater_count: number;
}

interface CommunityTrackAvg {
  track_position: number;
  avg_rating: number;
  rater_count: number;
}

export function RatedMusicArtistTab({ artistName }: { artistName: string }) {
  const decodedName = decodeURIComponent(artistName);
  const { user } = useAuth();
  const { toast } = useToast();

  const [albumRatings, setAlbumRatings] = useState<AlbumRating[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumRating | null>(null);
  const [trackRatings, setTrackRatings] = useState<TrackRating[]>([]);
  const [communityAlbumAvgs, setCommunityAlbumAvgs] = useState<CommunityAlbumAvg[]>([]);
  const [communityTrackAvgs, setCommunityTrackAvgs] = useState<CommunityTrackAvg[]>([]);
  const [showCommunity, setShowCommunity] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const discographyGradientId = useId().replace(/:/g, '');
  const trackGradientId = useId().replace(/:/g, '');

  useEffect(() => {
    const fetchRatings = async () => {
      if (!user || !decodedName) return;
      setIsLoading(true);
      try {
        const { data: ratingsRows, error } = await supabase
          .from('album_ratings')
          .select('album_deezer_id, album_title, rating, rated_at, cover_url')
          .eq('user_id', user.id)
          .eq('artist_name', decodedName);
        if (error) throw error;

        const rows = ratingsRows ?? [];
        const deezerIds = rows
          .map((r) => r.album_deezer_id)
          .filter((v): v is string => Boolean(v));

        let releaseMap = new Map<string, string | null>();
        if (deezerIds.length > 0) {
          const { data: cacheRows } = await supabase
            .from('albums_cache')
            .select('deezer_id, release_date')
            .in('deezer_id', deezerIds);
          if (cacheRows) {
            releaseMap = new Map(
              cacheRows
                .filter(
                  (row): row is { deezer_id: string; release_date: string | null } =>
                    Boolean(row.deezer_id),
                )
                .map((row) => [row.deezer_id, row.release_date]),
            );
          }
        }

        const enriched: AlbumRating[] = rows.map((r) => ({
          album_deezer_id: r.album_deezer_id ?? '',
          album_title: r.album_title,
          rating: r.rating,
          rated_at: r.rated_at,
          cover_url: r.cover_url,
          release_date: releaseMap.get(r.album_deezer_id ?? '') ?? null,
        }));

        enriched.sort((a, b) => {
          const da = a.release_date ?? '9999-12-31';
          const db = b.release_date ?? '9999-12-31';
          if (da !== db) return da.localeCompare(db);
          return a.rated_at.localeCompare(b.rated_at);
        });

        setAlbumRatings(enriched);
        if (enriched.length > 0) setSelectedAlbum(enriched[0]);
      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Failed to load ratings.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetchRatings();
  }, [user, decodedName, toast]);

  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const { data, error } = await supabase.rpc('get_community_album_averages');
        if (error) throw error;
        setCommunityAlbumAvgs(
          (data || []).map((entry: any) => ({
            album_deezer_id: entry.album_deezer_id,
            avg_rating: Number(entry.avg_rating),
            rater_count: Number(entry.rater_count),
          })),
        );
      } catch (error) {
        console.error('Community averages error:', error);
      }
    };
    fetchCommunity();
  }, []);

  useEffect(() => {
    const fetchTracks = async () => {
      if (!user || !selectedAlbum) {
        setTrackRatings([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('track_ratings')
          .select('track_position, track_title, rating')
          .eq('user_id', user.id)
          .eq('album_deezer_id', selectedAlbum.album_deezer_id)
          .order('track_position', { ascending: true });
        if (error) throw error;
        setTrackRatings(data || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchTracks();
  }, [user, selectedAlbum]);

  useEffect(() => {
    const fetchCommunityTracks = async () => {
      if (!selectedAlbum) {
        setCommunityTrackAvgs([]);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_community_track_averages', {
          p_album_deezer_id: selectedAlbum.album_deezer_id,
        });
        if (error) throw error;
        setCommunityTrackAvgs(
          (data || []).map((entry: any) => ({
            track_position: entry.track_position,
            avg_rating: Number(entry.avg_rating),
            rater_count: Number(entry.rater_count),
          })),
        );
      } catch (error) {
        console.error('Community track averages error:', error);
      }
    };
    fetchCommunityTracks();
  }, [selectedAlbum]);

  const discographyData = useMemo(() => {
    const communityMap = new Map(
      communityAlbumAvgs.map((entry) => [entry.album_deezer_id, entry]),
    );
    return albumRatings.map((rating) => {
      const community = communityMap.get(rating.album_deezer_id);
      return {
        name:
          rating.album_title.length > 20
            ? `${rating.album_title.slice(0, 18)}…`
            : rating.album_title,
        fullTitle: rating.album_title,
        yourRating: rating.rating,
        communityRating: community?.avg_rating ?? null,
        communityCount: community?.rater_count ?? 0,
        cover: rating.cover_url,
      };
    });
  }, [albumRatings, communityAlbumAvgs]);

  const trackChartData = useMemo(() => {
    const communityMap = new Map(
      communityTrackAvgs.map((entry) => [entry.track_position, entry]),
    );
    return trackRatings.map((track) => {
      const community = communityMap.get(track.track_position);
      return {
        name:
          track.track_title.length > 15
            ? `${track.track_title.slice(0, 13)}…`
            : track.track_title,
        fullTitle: track.track_title,
        position: track.track_position,
        yourRating: track.rating,
        communityRating: community?.avg_rating ?? null,
        communityCount: community?.rater_count ?? 0,
      };
    });
  }, [trackRatings, communityTrackAvgs]);

  const { imageUrl: artistImageUrl } = useArtistImage(decodedName);

  const avgRating = albumRatings.length
    ? albumRatings.reduce((sum, r) => sum + r.rating, 0) / albumRatings.length
    : 0;

  const ratingLegendItems = showCommunity
    ? [
        { label: 'My Rating', color: chartPalette.primary, helper: 'Personal arc' },
        {
          label: 'Community Avg',
          color: chartPalette.accent,
          helper: 'All listeners',
          dashed: true,
        },
      ]
    : [{ label: 'My Rating', color: chartPalette.primary, helper: 'Personal arc' }];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <TooltipShell className="max-w-xs">
        <div className="flex items-start gap-3">
          {data?.cover ? (
            <img
              src={data.cover}
              alt={data.fullTitle || label}
              className="h-14 w-14 rounded-xl object-cover"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{data?.fullTitle || label}</p>
            {typeof data?.position === 'number' ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Track {data.position}
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              {payload.map((entry: any, index: number) => (
                <div
                  key={`${entry.name}-${index}`}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.name}
                  </span>
                  <span className="font-mono text-foreground">
                    {entry.value}/10
                    {entry.dataKey === 'communityRating' && data?.communityCount
                      ? ` · ${data.communityCount} users`
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TooltipShell>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Build a semicircular gauge (SVG) for average score
  const pct = Math.max(0, Math.min(1, avgRating / 10));
  const gaugeRadius = 90;
  const cx = 110;
  const cy = 110;
  const startAngle = Math.PI; // 180°
  const endAngle = 0; // 0°
  const arcAngle = startAngle - (startAngle - endAngle) * pct;
  const arcEndX = cx + gaugeRadius * Math.cos(arcAngle);
  const arcEndY = cy - gaugeRadius * Math.sin(arcAngle);
  const arcStartX = cx + gaugeRadius * Math.cos(startAngle);
  const arcStartY = cy - gaugeRadius * Math.sin(startAngle);

  return (
    <div>
      <Link
        to="/dashboard/rated-music"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All rated artists
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/40 p-8 mb-10"
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_45%)]" />
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary flex items-center justify-center">
              {artistImageUrl ? (
                <img
                  src={artistImageUrl}
                  alt={decodedName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-boldonse">{decodedName}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {albumRatings.length} albums rated
              </p>
            </div>
          </div>

          {albumRatings.length > 0 && (
            <div className="flex flex-col items-center">
              <svg width="220" height="130" viewBox="0 0 220 130">
                <path
                  d={`M ${arcStartX} ${arcStartY} A ${gaugeRadius} ${gaugeRadius} 0 0 1 ${cx + gaugeRadius} ${cy}`}
                  stroke="hsl(var(--border))"
                  strokeWidth="18"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={`M ${arcStartX} ${arcStartY} A ${gaugeRadius} ${gaugeRadius} 0 ${pct > 0.5 ? 1 : 0} 1 ${arcEndX} ${arcEndY}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth="18"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground -mt-2">
                Average Score
              </p>
              <p className="text-3xl font-bold mt-1">{avgRating.toFixed(1)}/10</p>
            </div>
          )}
        </div>
      </motion.div>

      <ChartPanel className="mb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Discography Evolution</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your artist arc with an optional community overlay.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 rounded-full border border-border/50 bg-background/50 px-4 py-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>Community</span>
            <Switch checked={showCommunity} onCheckedChange={setShowCommunity} />
          </div>
        </div>

        {discographyData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={discographyData}
                margin={{ top: 12, right: 12, bottom: 12, left: -12 }}
              >
                <defs>
                  <linearGradient id={discographyGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartPalette.primary} stopOpacity="0.36" />
                    <stop offset="65%" stopColor={chartPalette.primary} stopOpacity="0.12" />
                    <stop offset="100%" stopColor={chartPalette.primary} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartPalette.grid} strokeDasharray="3 10" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: chartPalette.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={14}
                  minTickGap={20}
                  interval={0}
                  angle={-22}
                  textAnchor="end"
                  height={72}
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  tick={{ fill: chartPalette.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <ReferenceLine y={5} stroke={chartPalette.axisSoft} strokeDasharray="4 10" />
                <Tooltip
                  cursor={{ stroke: chartPalette.primarySoft, strokeWidth: 1 }}
                  content={<CustomTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="yourRating"
                  name="My Rating"
                  stroke={chartPalette.primary}
                  fill={`url(#${discographyGradientId})`}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: chartPalette.primary,
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
                {showCommunity ? (
                  <Area
                    type="monotone"
                    dataKey="communityRating"
                    name="Community Avg"
                    stroke={chartPalette.accent}
                    fill="none"
                    fillOpacity={0}
                    strokeWidth={2.2}
                    strokeDasharray="8 8"
                    dot={false}
                    connectNulls
                  />
                ) : null}
              </AreaChart>
            </ResponsiveContainer>
            <LegendPills items={ratingLegendItems} />
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No rated albums for this artist yet
          </div>
        )}
      </ChartPanel>

      {albumRatings.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Select album to view track rhythm</h3>
          <div className="flex flex-wrap gap-3">
            {albumRatings.map((rating) => (
              <button
                key={rating.album_deezer_id}
                onClick={() => setSelectedAlbum(rating)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedAlbum?.album_deezer_id === rating.album_deezer_id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border/50 text-foreground hover:border-primary/50'
                }`}
              >
                {rating.album_title}
                <span className="opacity-70">{rating.rating}/10</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedAlbum && trackRatings.length > 0 ? (
        <ChartPanel>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold">{selectedAlbum.album_title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Track-by-track motion of your album score.
              </p>
            </div>
            <Link to={`/album/${selectedAlbum.album_deezer_id}`}>
              <Button variant="outline" size="sm">
                View album
              </Button>
            </Link>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <AreaChart
              data={trackChartData}
              margin={{ top: 12, right: 12, bottom: 12, left: -12 }}
            >
              <defs>
                <linearGradient id={trackGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartPalette.gradientStart} stopOpacity="0.34" />
                  <stop offset="65%" stopColor={chartPalette.gradientEnd} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={chartPalette.gradientEnd} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartPalette.grid} strokeDasharray="3 10" />
              <XAxis
                dataKey="name"
                tick={{ fill: chartPalette.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={14}
                minTickGap={16}
                interval={0}
                angle={-22}
                textAnchor="end"
                height={72}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fill: chartPalette.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={34}
              />
              <ReferenceLine y={5} stroke={chartPalette.axisSoft} strokeDasharray="4 10" />
              <Tooltip
                cursor={{ stroke: chartPalette.primarySoft, strokeWidth: 1 }}
                content={<CustomTooltip />}
              />
              <Area
                type="monotone"
                dataKey="yourRating"
                name="My Rating"
                stroke={chartPalette.gradientEnd}
                fill={`url(#${trackGradientId})`}
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              {showCommunity ? (
                <Area
                  type="monotone"
                  dataKey="communityRating"
                  name="Community Avg"
                  stroke={chartPalette.accent}
                  fill="none"
                  fillOpacity={0}
                  strokeWidth={2.2}
                  strokeDasharray="8 8"
                  dot={false}
                  connectNulls
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>

          <LegendPills items={ratingLegendItems} />
        </ChartPanel>
      ) : null}

      {selectedAlbum && trackRatings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground rounded-2xl border border-border/40 bg-card/40">
          <p>No individual track ratings for this album yet.</p>
          <Link to={`/album/${selectedAlbum.album_deezer_id}`}>
            <Button variant="outline" className="mt-4">
              Rate Tracks
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
