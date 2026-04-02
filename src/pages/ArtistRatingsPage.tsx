import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Disc3, User, Users } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCoverArtUrl } from '@/lib/musicbrainz';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface AlbumRating {
  album_mbid: string;
  album_title: string;
  rating: number;
  rated_at: string;
  cover_url: string | null;
}

interface TrackRating {
  track_position: number;
  track_title: string;
  rating: number;
}

interface CommunityAlbumAvg {
  album_mbid: string;
  avg_rating: number;
  rater_count: number;
}

interface CommunityTrackAvg {
  track_position: number;
  avg_rating: number;
  rater_count: number;
}

const ArtistRatingsPage = () => {
  const { artistName } = useParams<{ artistName: string }>();
  const decodedName = decodeURIComponent(artistName || '');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [albumRatings, setAlbumRatings] = useState<AlbumRating[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumRating | null>(null);
  const [trackRatings, setTrackRatings] = useState<TrackRating[]>([]);
  const [communityAlbumAvgs, setCommunityAlbumAvgs] = useState<CommunityAlbumAvg[]>([]);
  const [communityTrackAvgs, setCommunityTrackAvgs] = useState<CommunityTrackAvg[]>([]);
  const [showCommunity, setShowCommunity] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Fetch user's album ratings for this artist
  useEffect(() => {
    const fetch = async () => {
      if (!user || !decodedName) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('album_ratings')
          .select('album_mbid, album_title, rating, rated_at, cover_url')
          .eq('user_id', user.id)
          .eq('artist_name', decodedName)
          .order('rated_at', { ascending: true });
        if (error) throw error;
        setAlbumRatings(data || []);
      } catch (e) {
        console.error(e);
        toast({ title: 'Error', description: 'Failed to load ratings.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetch();
  }, [user, decodedName, toast]);

  // Fetch community album averages
  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const { data, error } = await supabase.rpc('get_community_album_averages');
        if (error) throw error;
        setCommunityAlbumAvgs((data || []).map((d: any) => ({
          album_mbid: d.album_mbid,
          avg_rating: Number(d.avg_rating),
          rater_count: Number(d.rater_count),
        })));
      } catch (e) {
        console.error('Community averages error:', e);
      }
    };
    fetchCommunity();
  }, []);

  // Fetch track ratings for selected album
  useEffect(() => {
    const fetchTracks = async () => {
      if (!user || !selectedAlbum) { setTrackRatings([]); return; }
      try {
        const { data, error } = await supabase
          .from('track_ratings')
          .select('track_position, track_title, rating')
          .eq('user_id', user.id)
          .eq('album_mbid', selectedAlbum.album_mbid)
          .order('track_position', { ascending: true });
        if (error) throw error;
        setTrackRatings(data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchTracks();
  }, [user, selectedAlbum]);

  // Fetch community track averages for selected album
  useEffect(() => {
    const fetchCommunityTracks = async () => {
      if (!selectedAlbum) { setCommunityTrackAvgs([]); return; }
      try {
        const { data, error } = await supabase.rpc('get_community_track_averages', {
          p_album_mbid: selectedAlbum.album_mbid,
        });
        if (error) throw error;
        setCommunityTrackAvgs((data || []).map((d: any) => ({
          track_position: d.track_position,
          avg_rating: Number(d.avg_rating),
          rater_count: Number(d.rater_count),
        })));
      } catch (e) {
        console.error('Community track averages error:', e);
      }
    };
    fetchCommunityTracks();
  }, [selectedAlbum]);

  // Discography chart data
  const discographyData = useMemo(() => {
    const communityMap = new Map(communityAlbumAvgs.map(c => [c.album_mbid, c]));
    return albumRatings.map((r, i) => {
      const community = communityMap.get(r.album_mbid);
      return {
        name: r.album_title.length > 20 ? r.album_title.slice(0, 18) + '…' : r.album_title,
        fullTitle: r.album_title,
        yourRating: r.rating,
        communityRating: community?.avg_rating ?? null,
        communityCount: community?.rater_count ?? 0,
        cover: r.cover_url,
        mbid: r.album_mbid,
      };
    });
  }, [albumRatings, communityAlbumAvgs]);

  // Track chart data
  const trackChartData = useMemo(() => {
    const communityMap = new Map(communityTrackAvgs.map(c => [c.track_position, c]));
    return trackRatings.map(t => {
      const community = communityMap.get(t.track_position);
      return {
        name: t.track_title.length > 15 ? t.track_title.slice(0, 13) + '…' : t.track_title,
        fullTitle: t.track_title,
        position: t.track_position,
        yourRating: t.rating,
        communityRating: community?.avg_rating ?? null,
        communityCount: community?.rater_count ?? 0,
      };
    });
  }, [trackRatings, communityTrackAvgs]);

  const artistImageUrl = `https://www.theaudiodb.com/images/media/artist/thumb/${decodedName.toLowerCase().replace(/\s+/g, '')}.jpg`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="glass rounded-xl p-3 max-w-xs">
        <p className="font-semibold text-sm">{data?.fullTitle || label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {p.value}/10
            {p.dataKey === 'communityRating' && data?.communityCount && ` (${data.communityCount} users)`}
          </p>
        ))}
      </div>
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
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/ratings">My Ratings</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{decodedName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Band Header */}
          <div className="flex flex-col md:flex-row gap-6 mb-10">
            {/* Artist Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full md:w-80 bg-card rounded-2xl border border-border/50 p-6 flex-shrink-0"
            >
              <div className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden bg-secondary flex items-center justify-center">
                {!imageError ? (
                  <img
                    src={artistImageUrl}
                    alt={decodedName}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <h2 className="text-xl font-bold text-center mb-2">{decodedName}</h2>
              <div className="text-center space-y-1 text-sm text-muted-foreground">
                <p>{albumRatings.length} albums rated</p>
                {albumRatings.length > 0 && (
                  <p className="text-lg font-bold gradient-text">
                    Avg: {(albumRatings.reduce((s, r) => s + r.rating, 0) / albumRatings.length).toFixed(1)}/10
                  </p>
                )}
              </div>
            </motion.div>

            {/* Discography Evolution Graph */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 bg-card/50 rounded-2xl border border-border/50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Discography Evolution</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Community</span>
                  <Switch checked={showCommunity} onCheckedChange={setShowCommunity} />
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Disc3 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : discographyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={discographyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'hsl(215, 16%, 56%)', fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fill: 'hsl(215, 16%, 56%)' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="yourRating"
                      name="Your Rating"
                      stroke="hsl(174, 72%, 56%)"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: 'hsl(174, 72%, 56%)', cursor: 'pointer' }}
                      activeDot={{ r: 7 }}
                      connectNulls
                    />
                    {showCommunity && (
                      <Line
                        type="monotone"
                        dataKey="communityRating"
                        name="Community Avg"
                        stroke="hsl(326, 78%, 60%)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 4, fill: 'hsl(326, 78%, 60%)' }}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No rated albums for this artist yet
                </div>
              )}
            </motion.div>
          </div>

          {/* Album Selection */}
          {albumRatings.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Select album to view track rhythm</h3>
              <div className="flex flex-wrap gap-3">
                {albumRatings.map(r => (
                  <button
                    key={r.album_mbid}
                    onClick={() => setSelectedAlbum(selectedAlbum?.album_mbid === r.album_mbid ? null : r)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      selectedAlbum?.album_mbid === r.album_mbid
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border/50 text-foreground hover:border-primary/50'
                    }`}
                  >
                    {r.album_title}
                    <span className="opacity-70">{r.rating}/10</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track Rhythm Graph */}
          {selectedAlbum && trackRatings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/50 rounded-2xl border border-border/50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    Track Rhythm — {selectedAlbum.album_title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Track-by-track rating flow
                  </p>
                </div>
                <Link to={`/album/${selectedAlbum.album_mbid}`}>
                  <Button variant="outline" size="sm">View Album</Button>
                </Link>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trackChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: 'hsl(215, 16%, 56%)', fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis domain={[0, 10]} ticks={[2, 4, 6, 8, 10]} tick={{ fill: 'hsl(215, 16%, 56%)' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="yourRating"
                    name="Your Rating"
                    stroke="hsl(174, 72%, 56%)"
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: 'hsl(174, 72%, 56%)' }}
                    connectNulls
                  />
                  {showCommunity && (
                    <Line
                      type="monotone"
                      dataKey="communityRating"
                      name="Community Avg"
                      stroke="hsl(326, 78%, 60%)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: 'hsl(326, 78%, 60%)' }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {selectedAlbum && trackRatings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No individual track ratings for this album yet.</p>
              <Link to={`/album/${selectedAlbum.album_mbid}`}>
                <Button variant="outline" className="mt-4">Rate Tracks</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtistRatingsPage;
