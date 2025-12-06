import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, MapPin, Calendar } from 'lucide-react';
import type { MusicBrainzArtist } from '@/lib/musicbrainz';

interface ArtistCardProps {
  artist: MusicBrainzArtist;
  index?: number;
}

export function ArtistCard({ artist, index = 0 }: ArtistCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link
        to={`/artist/${artist.id}`}
        className="block group"
      >
        <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 p-6 transition-all duration-300 hover:border-primary/50 hover:glow-primary">
          {/* Avatar placeholder */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <User className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>

          {/* Name */}
          <h3 className="text-lg font-semibold text-center mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {artist.name}
          </h3>

          {/* Disambiguation */}
          {artist.disambiguation && (
            <p className="text-sm text-muted-foreground text-center mb-3 line-clamp-2">
              {artist.disambiguation}
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            {artist.country && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {artist.country}
              </span>
            )}
            {artist['life-span']?.begin && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {artist['life-span'].begin.split('-')[0]}
              </span>
            )}
          </div>

          {/* Type badge */}
          {artist.type && (
            <div className="absolute top-4 right-4">
              <span className="px-2 py-1 rounded-full bg-secondary text-xs text-muted-foreground">
                {artist.type}
              </span>
            </div>
          )}

          {/* Score indicator */}
          {artist.score !== undefined && (
            <div className="absolute top-4 left-4">
              <span className="px-2 py-1 rounded-full gradient-bg text-xs text-primary-foreground font-medium">
                {artist.score}%
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
