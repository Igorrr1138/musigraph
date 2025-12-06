import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Disc3, Calendar, Star } from 'lucide-react';
import { getCoverArtUrl } from '@/lib/musicbrainz';

interface AlbumCardProps {
  album: {
    id: string;
    title: string;
    artistName?: string;
    releaseDate?: string;
    type?: string;
  };
  index?: number;
  rating?: number;
  showRating?: boolean;
}

export function AlbumCard({ album, index = 0, rating, showRating }: AlbumCardProps) {
  const [imageError, setImageError] = useState(false);
  const coverUrl = getCoverArtUrl(album.id, '500');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        to={`/album/${album.id}`}
        className="block group"
      >
        <div className="album-card">
          {/* Cover Art */}
          <div className="aspect-square relative overflow-hidden rounded-xl bg-secondary">
            {!imageError ? (
              <img
                src={coverUrl}
                alt={album.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={() => setImageError(true)}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Disc3 className="w-16 h-16 text-muted-foreground animate-float" />
              </div>
            )}

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Rating badge */}
            {showRating && rating && (
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full gradient-bg text-primary-foreground text-sm font-bold">
                <Star className="w-3.5 h-3.5 fill-current" />
                {rating}
              </div>
            )}

            {/* Type badge */}
            {album.type && (
              <div className="absolute top-3 left-3">
                <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs text-foreground">
                  {album.type}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="mt-3 space-y-1">
            <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
              {album.title}
            </h3>
            {album.artistName && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {album.artistName}
              </p>
            )}
            {album.releaseDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {album.releaseDate.split('-')[0]}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
