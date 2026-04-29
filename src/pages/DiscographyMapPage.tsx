import { useState, useEffect, useMemo, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Disc3, Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartPanel,
  LegendPills,
  TooltipShell,
  chartPalette,
  getBrandRatingColor,
} from '@/components/charts/brand-charts';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TrackRating {
  album_deezer_id: string;
  track_position: number;
  rating: number;
}

interface AlbumRating {
  album_deezer_id: string;
  album_title: string;
  artist_name: string | null;
  cover_url: string | null;
  rated_at: string;
}

interface ChartPoint {
  x: number;
  y: number;
  album: string;
  artist: string;
  cover: string | null;
  mbid: string;
  tracksRated: number;
}

const DiscographyMapPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [albumRatings, setAlbumRatings] = useState<AlbumRating[]>([]);
  const [trackRatings, setTrackRatings] = useState<TrackRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mapGradientId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const [albumRes, trackRes] = await Promise.all([
          supabase
            .from('album_ratings')
            .select('album_deezer_id, album_title, artist_name, cover_url, rated_at')
            .eq('user_id', user.id),
          supabase
            .from('track_ratings')
            .select('album_deezer_id, track_position, rating')
            .eq('user_id', user.id),
        ]);

        if (albumRes.error) throw albumRes.error;
        if (trackRes.error) throw trackRes.error;

        setAlbumRatings(albumRes.data || []);
        setTrackRatings(trackRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load discography data.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, toast]);

  const chartData: ChartPoint[] = useMemo(() => {
    const albumScores: Record<string, { total: number; count: number }> = {};

    trackRatings.forEach((trackRating) => {
      if (!albumScores[trackRating.album_deezer_id]) {
        albumScores[trackRating.album_deezer_id] = { total: 0, count: 0 };
      }
      albumScores[trackRating.album_deezer_id].total += trackRating.rating;
      albumScores[trackRating.album_deezer_id].count += 1;
    });

    return albumRatings
      .filter((albumRating) => albumScores[albumRating.album_deezer_id])
      .map((albumRating) => {
        const score = albumScores[albumRating.album_deezer_id];
        const avg = score.total / score.count;
        const year = new Date(albumRating.rated_at).getFullYear();

        return {
          x: year,
          y: Number(avg.toFixed(1)),
          album: albumRating.album_title,
          artist: albumRating.artist_name || 'Unknown',
          cover: albumRating.cover_url,
          mbid: albumRating.album_deezer_id,
          tracksRated: score.count,
        };
      })
      .sort((a, b) => a.x - b.x);
  }, [albumRatings, trackRatings]);

  const avgScore = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((sum, point) => sum + point.y, 0) / chartData.length;
  }, [chartData]);

  const years = chartData.map((entry) => entry.x);
  const minYear = years.length > 0 ? Math.min(...years) - 1 : 2020;
  const maxYear = years.length > 0 ? Math.max(...years) + 1 : 2026;

  const downloadGraph = () => {
    const svg = document.querySelector('.recharts-wrapper svg');
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'discography-map.svg';
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'Your discography map has been saved.' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;

    return (
      <TooltipShell>
        <div className="flex items-start gap-3">
          {data.cover ? (
            <img
              src={data.cover}
              alt={data.album}
              className="w-16 h-16 rounded-xl object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground line-clamp-2">{data.album}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{data.artist}</p>
            <div className="mt-3 flex items-center justify-between gap-4 text-xs">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Album score
              </span>
              <span className="font-mono text-foreground">{data.y}/10</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>{data.x}</span>
              <span>{data.tracksRated} tracks rated</span>
            </div>
          </div>
        </div>
      </TooltipShell>
    );
  };

  const renderDot = ({ cx, cy, payload }: any) => {
    if (cx == null || cy == null || !payload) return null;
    const tone = getBrandRatingColor(payload.y);

    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill={tone} fillOpacity={0.18} />
        <circle cx={cx} cy={cy} r={4.25} fill={tone} stroke="hsl(var(--background))" strokeWidth={1.75} />
      </g>
    );
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-24 px-4 pb-12">
        <div className="container mx-auto max-w-6xl">
          <Link
            to="/ratings"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to ratings
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Discography Map</h1>
              <p className="text-muted-foreground">Album score trajectory built from your track ratings.</p>
            </div>
            {chartData.length > 0 ? (
              <Button onClick={downloadGraph} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <ChartPanel>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Album score drift</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every point is an album, connected by the order in which you rated it.
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={420}>
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 18, left: -6 }}>
                    <defs>
                      <linearGradient id={mapGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartPalette.gradientEnd} stopOpacity="0.34" />
                        <stop offset="58%" stopColor={chartPalette.primary} stopOpacity="0.12" />
                        <stop offset="100%" stopColor={chartPalette.primary} stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={chartPalette.grid} strokeDasharray="3 10" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[minYear, maxYear]}
                      allowDecimals={false}
                      tick={{ fill: chartPalette.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      label={{
                        value: 'Year rated',
                        position: 'insideBottom',
                        offset: -10,
                        fill: chartPalette.axis,
                      }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fill: chartPalette.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      label={{
                        value: 'Album score',
                        angle: -90,
                        position: 'insideLeft',
                        fill: chartPalette.axis,
                      }}
                    />
                    <ReferenceLine y={avgScore} stroke={chartPalette.gradientEnd} strokeDasharray="8 8" />
                    <Tooltip
                      cursor={{ stroke: chartPalette.primarySoft, strokeWidth: 1 }}
                      content={<CustomTooltip />}
                    />
                    <Area
                      type="linear"
                      dataKey="y"
                      name="Album Score"
                      stroke={chartPalette.primary}
                      fill={`url(#${mapGradientId})`}
                      strokeWidth={3}
                      dot={renderDot}
                      activeDot={{ r: 6, fill: chartPalette.primary, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <LegendPills
                  items={[
                    { label: 'Album Score', color: chartPalette.primary, helper: 'Per rated album' },
                    { label: 'Average', color: chartPalette.gradientEnd, helper: `${avgScore.toFixed(1)}/10`, dashed: true },
                  ]}
                />
              </ChartPanel>
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No album scores yet</h3>
              <p className="text-muted-foreground mb-6">
                Rate individual tracks on album pages to build your discography map
              </p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">Discover Music</Button>
              </Link>
            </div>
          )}

          {chartData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { label: 'Albums Scored', value: chartData.length },
                { label: 'Avg Album Score', value: avgScore.toFixed(1) },
                { label: 'Best Score', value: Math.max(...chartData.map((entry) => entry.y)).toFixed(1) },
                { label: 'Total Tracks Rated', value: trackRatings.length },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-xl bg-card/50 border border-border/50 text-center">
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DiscographyMapPage;
