import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Trash2, Disc3, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCoverArtUrl } from '@/lib/musicbrainz';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Rating {
  id: string;
  album_mbid: string;
  album_title: string;
  artist_name: string | null;
  cover_url: string | null;
  rating: number;
  rated_at: string;
}

const RatingsPage = () => {
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
          .order('rated_at', { ascending: false });

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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('album_ratings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRatings(ratings.filter((r) => r.id !== id));
      toast({
        title: 'Rating deleted',
        description: 'Your rating has been removed.',
      });
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rating.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Disc3 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  const averageRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Ratings</h1>
              <p className="text-muted-foreground">
                {ratings.length} albums rated • Average: {averageRating}/10
              </p>
            </div>
            {ratings.length > 0 && (
              <Link to="/graph">
                <Button className="gradient-bg text-primary-foreground border-0">
                  View Rating Graph
                </Button>
              </Link>
            )}
          </div>

          {/* Ratings Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Disc3 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : ratings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ratings.map((rating, index) => (
                <RatingCard
                  key={rating.id}
                  rating={rating}
                  index={index}
                  onDelete={() => handleDelete(rating.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Disc3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No ratings yet</h3>
              <p className="text-muted-foreground mb-6">
                Start exploring and rating your favorite albums
              </p>
              <Link to="/">
                <Button className="gradient-bg text-primary-foreground border-0">
                  Discover Music
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function RatingCard({
  rating,
  index,
  onDelete,
}: {
  rating: Rating;
  index: number;
  onDelete: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group relative bg-card rounded-2xl border border-border/50 overflow-hidden hover:border-primary/50 transition-all"
    >
      <Link to={`/album/${rating.album_mbid}`}>
        <div className="aspect-square relative">
          {!imageError && rating.cover_url ? (
            <img
              src={rating.cover_url}
              alt={rating.album_title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Disc3 className="w-16 h-16 text-muted-foreground" />
            </div>
          )}

          {/* Rating badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full gradient-bg text-primary-foreground font-bold">
            <Star className="w-4 h-4 fill-current" />
            {rating.rating}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
        </div>

        <div className="p-4">
          <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
            {rating.album_title}
          </h3>
          {rating.artist_name && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {rating.artist_name}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Rated {new Date(rating.rated_at).toLocaleDateString()}
          </p>
        </div>
      </Link>

      {/* Delete button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rating</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your rating for "{rating.album_title}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

export default RatingsPage;
