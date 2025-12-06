import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Disc3, Download, ZoomIn, ZoomOut } from 'lucide-react';
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
} from 'recharts';

interface Rating {
  id: string;
  album_mbid: string;
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

    if (user) {
      fetchRatings();
    }
  }, [user, toast]);

  const chartData: ChartDataPoint[] = useMemo(() => {
    return ratings.map((rating, index) => ({
      x: index + 1,
      y: rating.rating,
      album: rating.album_title,
      artist: rating.artist_name || 'Unknown',
      cover: rating.cover_url,
      date: new Date(rating.rated_at).toLocaleDateString(),
      mbid: rating.album_mbid,
    }));
  }, [ratings]);

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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

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
                <span className="text-xs text-muted-foreground">{data.date}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const getColorByRating = (rating: number) => {
    if (rating >= 8) return 'hsl(174, 72%, 56%)'; // Primary
    if (rating >= 6) return 'hsl(45, 93%, 47%)'; // Gold
    if (rating >= 4) return 'hsl(326, 78%, 60%)'; // Accent
    return 'hsl(0, 72%, 51%)'; // Destructive
  };

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

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Rating Timeline</h1>
              <p className="text-muted-foreground">
                Visualize your album ratings over time
              </p>
            </div>
            {ratings.length > 0 && (
              <Button onClick={downloadGraph} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Graph
              </Button>
            )}
          </div>

          {/* Graph */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : ratings.length > 0 ? (
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
                    name="Album #"
                    domain={[0, 'dataMax + 1']}
                    tick={{ fill: 'hsl(215, 16%, 56%)' }}
                    label={{
                      value: 'Albums (chronological order)',
                      position: 'insideBottom',
                      offset: -10,
                      fill: 'hsl(215, 16%, 56%)',
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Rating"
                    domain={[0, 10]}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    tick={{ fill: 'hsl(215, 16%, 56%)' }}
                    label={{
                      value: 'Rating (1-10)',
                      angle: -90,
                      position: 'insideLeft',
                      fill: 'hsl(215, 16%, 56%)',
                    }}
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
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No ratings yet</h3>
              <p className="text-muted-foreground mb-6">
                Rate some albums to see your rating graph
              </p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">
                  Discover Music
                </Button>
              </Link>
            </div>
          )}

          {/* Stats */}
          {ratings.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              {[
                {
                  label: 'Total Rated',
                  value: ratings.length,
                },
                {
                  label: 'Average Rating',
                  value: (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1),
                },
                {
                  label: 'Highest Rating',
                  value: Math.max(...ratings.map((r) => r.rating)),
                },
                {
                  label: 'Most Recent',
                  value: new Date(ratings[ratings.length - 1]?.rated_at).toLocaleDateString(),
                },
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

export default GraphPage;
