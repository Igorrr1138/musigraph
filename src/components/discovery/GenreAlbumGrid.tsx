import { memo } from 'react';
import { AlbumCard } from '@/components/music/AlbumCard';
import type { DiscoveryAlbum } from '@/lib/genreDiscovery';

export interface GenreAlbumGridProps {
  albums: ReadonlyArray<DiscoveryAlbum>;
  isLoading: boolean;
}

function GenreAlbumGridImpl({ albums, isLoading }: GenreAlbumGridProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        aria-busy="true"
        aria-label="Loading albums"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No albums match those filters yet. Try a broader genre or clear the filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {albums.map((album, index) => (
        <AlbumCard key={String(album.id)} album={album} index={index} />
      ))}
    </div>
  );
}

export const GenreAlbumGrid = memo(GenreAlbumGridImpl);
