import { memo } from 'react';
import { ArtistCard } from '@/components/music/ArtistCard';
import type { DiscoveryArtist } from '@/lib/genreDiscovery';

export interface GenreArtistGridProps {
  artists: ReadonlyArray<DiscoveryArtist>;
  isLoading: boolean;
}

function GenreArtistGridImpl({ artists, isLoading }: GenreArtistGridProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        aria-busy="true"
        aria-label="Loading artists"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl bg-card/40 border border-border/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No artists match those filters yet. Try widening the decade or clearing the country filter.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {artists.map((artist, index) => (
        <ArtistCard key={String(artist.id)} artist={artist} index={index} />
      ))}
    </div>
  );
}

export const GenreArtistGrid = memo(GenreArtistGridImpl);
