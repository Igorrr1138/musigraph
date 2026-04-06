import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, User } from "lucide-react";

import { useArtistImage } from "@/hooks/useArtistImage";
import type { MusicBrainzArtist } from "@/lib/musicbrainz";

interface ArtistCardProps {
  artist: MusicBrainzArtist;
  index?: number;
}

export function ArtistCard({ artist, index = 0 }: ArtistCardProps) {
  const topGenre = [...(artist.tags ?? [])].sort((left, right) => right.count - left.count)[0]?.name;
  const { imageUrl, isLoading } = useArtistImage(artist.name, {
    musicBrainzId: artist.id,
    genreHint: [artist.disambiguation, topGenre].filter(Boolean),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link to={`/artist/${artist.id}`} className="group block">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:border-primary/50 hover:glow-primary">
          <div className="relative aspect-square overflow-hidden bg-secondary">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={artist.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {isLoading ? (
                  <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                ) : (
                  <User className="h-16 w-16 text-muted-foreground" />
                )}
              </div>
            )}

            {artist.type ? (
              <div className="absolute left-3 top-3">
                <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                  {artist.type}
                </span>
              </div>
            ) : null}

            {artist.country ? (
              <div className="absolute right-3 top-3">
                <span className="flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                  <MapPin className="h-3 w-3" />
                  {artist.country}
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5 p-4">
            <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-primary">
              {artist.name}
            </h3>
            {topGenre ? (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {topGenre}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
