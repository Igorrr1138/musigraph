import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { pickArtistImage, type DeezerArtist } from '@/lib/deezer';

interface ArtistCardProps {
  artist: DeezerArtist;
  index?: number;
}

// Memoised so the genre discovery grid only re-renders cards whose props
// actually changed (e.g. when filters reduce the result set). Without this
// every filter change causes O(N) re-renders of unchanged cards.
function ArtistCardImpl({ artist, index = 0 }: ArtistCardProps) {
  const imageUrl = pickArtistImage(artist);

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
                <User className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="p-4 space-y-1.5">
            <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
              {artist.name}
            </h3>
            {typeof artist.nb_fan === 'number' && artist.nb_fan > 0 && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground">
                {artist.nb_fan.toLocaleString()} fans
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export const ArtistCard = memo(ArtistCardImpl);
