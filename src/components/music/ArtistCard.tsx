import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, MapPin } from 'lucide-react';
import type { MusicBrainzArtist } from '@/lib/musicbrainz';
import { useArtistImage } from '@/hooks/useArtistImage';

interface ArtistCardProps {
  artist: MusicBrainzArtist;
  index?: number;
}

export function ArtistCard({ artist, index = 0 }: ArtistCardProps) {
  const { imageUrl, isLoading } = useArtistImage(artist.name);

  const topGenre = artist.tags
    ?.sort((a, b) => b.count - a.count)
    .find(t => t.name)?.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link to={`/artist/${artist.id}`} className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-300 hover:border-primary/50 hover:glow-primary">
          <div className="aspect-square relative overflow-hidden bg-secondary">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isLoading ? (
                  <div className="w-12 h-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                ) : (
                  <User className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
            )}

            {artist.type && (
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
                  {artist.type}
                </span>
              </div>
            )}

            {artist.country && (
              <div className="absolute top-3 right-3">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs font-medium text-foreground">
                  <MapPin className="w-3 h-3" />
                  {artist.country}
                </span>
              </div>
            )}
          </div>

          <div className="p-4 space-y-1.5">
            <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
              {artist.name}
            </h3>
            {topGenre && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground capitalize">
                {topGenre}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
