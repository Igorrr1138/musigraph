import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Disc3, Download } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface TrackRating {
  album_mbid: string;
  track_position: number;
  rating: number;
}

interface AlbumRating {
  album_mbid: string;
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
            .select('album_mbid, album_title, artist_name, cover_url, rated_at')
            .eq('user_id', user.id),
          supabase
            .from('track_ratings')
            .select('album_mbid, track_position, rating')
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
    // Group track ratings by album
    const albumScores: Record<string, { total: number; count: number }> = {};
    trackRatings.forEach((tr) => {
      if (!albumScores[tr.album_mbid]) {
        albumScores[tr.album_mbid] = { total: 0, count: 0 };
      }
      albumScores[tr.album_mbid].total += tr.rating;
      albumScores[tr.album_mbid].count += 1;
    });

    // Match with album info and extract year from rated_at (we use rated_at year as proxy; ideally release year)
    return albumRatings
      .filter((ar) => albumScores[ar.album_mbid])
      .map((ar) => {
        const score = albumScores[ar.album_mbid];
        const avg = score.total / score.count;
        const year = new Date(ar.rated_at).getFullYear();

        return {
          x: year,
          y: parseFloat(avg.toFixed(1)),
          album: ar.album_title,
          artist: ar.artist_name || 'Unknown',
          cover: ar.cover_url,
          mbid: ar.album_mbid,
          tracksRated: score.count,
        };
      })
      .sort((a, b) => a.x - b.x);
  }, [albumRatings, trackRatings]);

  const avgScore = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((s, d) => s + d.y, 0) / chartData.length;
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
    link.download = 'discography-map.svg';
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded!', description: 'Your discography map has been saved.' });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const getColorByRating = (rating: number) => {
    if (rating >= 8) return 'hsl(174, 72%, 56%)';
    if (rating >= 6) return 'hsl(45, 93%, 47%)';
    if (rating >= 4) return 'hsl(326, 78%, 60%)';
    return 'hsl(0, 72%, 51%)';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass rounded-xl p-4 max-w-xs">
          <div className="flex items-start gap-3">
            {data.cover && (
              <img
                src={data.cover}
                alt={data.album}
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div>
              <h4 className="font-semibold line-clamp-2">{data.album}</h4>
              <p className="text-sm text-muted-foreground">{data.artist}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-lg font-bold text-primary">{data.y}/10</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{data.tracksRated} tracks rated</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const years = chartData.map(d => d.x);
  const minYear = years.length > 0 ? Math.min(...years) - 1 : 2020;
  const maxYear = years.length > 0 ? Math.max(...years) + 1 : 2026;

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
              <p className="text-muted-foreground">
                Album scores (avg of track ratings) plotted over time
              </p>
            </div>
            {chartData.length > 0 && (
              <Button onClick={downloadGraph} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : chartData.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-card/50 rounded-2xl border border-border/50 p-6"
            >
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Year"
                    domain={[minYear, maxYear]}
                    tickFormatter={(v) => v.toString()}
                    tick={{ fill: 'hsl(215, 16%, 56%)' }}
                    label={{
                      value: 'Year Rated',
                      position: 'insideBottom',
                      offset: -10,
                      fill: 'hsl(215, 16%, 56%)',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Album Score"
                    domain={[0, 10]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    tick={{ fill: 'hsl(215, 16%, 56%)' }}
                    label={{
                      value: 'Album Score (1-10)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: 'hsl(215, 16%, 56%)',
                    }}
                  />
                  <ReferenceLine
                    y={avgScore}
                    stroke="hsl(174, 72%, 56%)"
                    strokeDasharray="6 4"
                    strokeOpacity={0.5}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter name="Albums" data={chartData}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getColorByRating(entry.y)}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/album/${entry.mbid}`)}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-6 border-t border-border">
                {[
                  { label: 'Excellent (8-10)', color: 'hsl(174, 72%, 56%)' },
                  { label: 'Good (6-7)', color: 'hsl(45, 93%, 47%)' },
                  { label: 'Average (4-5)', color: 'hsl(326, 78%, 60%)' },
                  { label: 'Poor (1-3)', color: 'hsl(0, 72%, 51%)' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 border-t-2 border-dashed border-primary/50" />
                  <span className="text-sm text-muted-foreground">Avg ({avgScore.toFixed(1)})</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No album scores yet</h3>
              <p className="text-muted-foreground mb-6">
                Rate individual tracks on album pages to build your discography map
              </p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">
                  Discover Music
                </Button>
              </Link>
            </div>
          )}

          {/* Stats */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                { label: 'Albums Scored', value: chartData.length },
                { label: 'Avg Album Score', value: avgScore.toFixed(1) },
                { label: 'Best Score', value: Math.max(...chartData.map(d => d.y)).toFixed(1) },
                { label: 'Total Tracks Rated', value: trackRatings.length },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-xl bg-card/50 border border-border/50 text-center"
                >
                  <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscographyMapPage;
