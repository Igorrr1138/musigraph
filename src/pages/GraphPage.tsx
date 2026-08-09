import { useState, useEffect, useMemo, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Disc3, Download } from '@/components/icons';
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Rating {
  id: string;
  album_deezer_id: string;
  album_title: string;
  artist_name: string | null;
  cover_url: string | null;
  rating: number;
  rated_at: string;
}

interface ChartDataPoint {
  x: number;
  y: number;
  album: string;
  artist: string;
  cover: string | null;
  date: string;
  mbid: string;
}

const GraphPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const timelineGradientId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('album_ratings')
          .select('*')
          .eq('user_id', user.id)
          .order('rated_at', { ascending: true });

        if (error) throw error;
        setRatings(data || []);
      } catch (error) {
        console.error('Error fetching ratings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load ratings.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) fetchRatings();
  }, [user, toast]);

  const chartData: ChartDataPoint[] = useMemo(
    () =>
      ratings.map((rating, index) => ({
        x: index + 1,
        y: rating.rating,
        album: rating.album_title,
        artist: rating.artist_name || 'Unknown',
        cover: rating.cover_url,
        date: new Date(rating.rated_at).toLocaleDateString(),
        mbid: rating.album_deezer_id,
      })),
    [ratings],
  );

  const averageRating = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData.reduce((sum, point) => sum + point.y, 0) / chartData.length;
  }, [chartData]);

  const downloadGraph = () => {
    const svg = document.querySelector('.recharts-wrapper svg');
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-music-ratings.svg';
    link.click();

    URL.revokeObjectURL(url);
    toast({
      title: 'Graph downloaded!',
      description: 'Your rating graph has been saved.',
    });
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
                Rating
              </span>
              <span className="font-mono text-foreground">{data.y}/10</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>Album #{data.x}</span>
              <span>{data.date}</span>
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
      <div className="bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background">

      <div className="pt-8 px-4 pb-12">
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
              <h1 className="text-3xl font-bold mb-2">Rating Timeline</h1>
              <p className="text-muted-foreground">A branded arc of every album you have scored.</p>
            </div>
            {ratings.length > 0 ? (
              <Button onClick={downloadGraph} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Graph
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : ratings.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <ChartPanel>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Your score curve</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read it left to right as your listening timeline.
                  </p>
                </div>

                <ResponsiveContainer width="100%" height={420}>
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 18, left: -6 }}>
                    <defs>
                      <linearGradient id={timelineGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartPalette.gradientStart} stopOpacity="0.34" />
                        <stop offset="55%" stopColor={chartPalette.primary} stopOpacity="0.12" />
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
                      label={{
                        value: 'Albums in rating order',
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
                        value: 'Score',
                        angle: -90,
                        position: 'insideLeft',
                        fill: chartPalette.axis,
                      }}
                    />
                    <ReferenceLine y={averageRating} stroke={chartPalette.gradientEnd} strokeDasharray="8 8" />
                    <Tooltip
                      cursor={{ stroke: chartPalette.primarySoft, strokeWidth: 1 }}
                      content={<CustomTooltip />}
                    />
                    <Area
                      type="monotoneX"
                      dataKey="y"
                      name="Rating"
                      stroke={chartPalette.primary}
                      fill={`url(#${timelineGradientId})`}
                      strokeWidth={3}
                      dot={renderDot}
                      activeDot={{ r: 6, fill: chartPalette.primary, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <LegendPills
                  items={[
                    { label: 'Rating Curve', color: chartPalette.primary, helper: 'Your full timeline' },
                    { label: 'Average', color: chartPalette.gradientEnd, helper: `${averageRating.toFixed(1)}/10`, dashed: true },
                  ]}
                />
              </ChartPanel>
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No ratings yet</h3>
              <p className="text-muted-foreground mb-6">Rate some albums to see your rating graph</p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">Discover Music</Button>
              </Link>
            </div>
          )}

          {ratings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                {
                  label: 'Total Rated',
                  value: ratings.length,
                },
                {
                  label: 'Average Rating',
                  value: (ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length).toFixed(1),
                },
                {
                  label: 'Highest Rating',
                  value: Math.max(...ratings.map((rating) => rating.rating)),
                },
                {
                  label: 'Most Recent',
                  value: new Date(ratings[ratings.length - 1]?.rated_at).toLocaleDateString(),
                },
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

export default GraphPage;
