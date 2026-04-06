import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Disc3, ExternalLink, MapPin, User } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { AlbumCard } from "@/components/music/AlbumCard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtistImage } from "@/hooks/useArtistImage";
import {
  getArtist,
  getArtistReleaseGroups,
  type MusicBrainzArtist,
  type MusicBrainzReleaseGroup,
} from "@/lib/musicbrainz";

function ArtistPageAvatar({
  artist,
}: {
  artist: MusicBrainzArtist;
}) {
  const topGenre = [...(artist.tags ?? [])].sort((left, right) => right.count - left.count)[0]?.name;
  const { imageUrl, isLoading } = useArtistImage(artist.name, {
    musicBrainzId: artist.id,
    genreHint: [artist.disambiguation, topGenre].filter(Boolean),
  });

  if (imageUrl) {
    return <img src={imageUrl} alt={artist.name} className="h-full w-full object-cover" />;
  }

  if (isLoading) {
    return <div className="h-12 w-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />;
  }

  return <User className="h-20 w-20 text-muted-foreground" />;
}

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<MusicBrainzArtist | null>(null);
  const [albums, setAlbums] = useState<MusicBrainzReleaseGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeOtherFilters, setActiveOtherFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const [artistData, albumsData] = await Promise.all([
          getArtist(id),
          getArtistReleaseGroups(id, 50),
        ]);

        setArtist(artistData);
        setAlbums(albumsData);
      } catch (error) {
        console.error("Error fetching artist:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  const yearsActive = useMemo(() => {
    const lifeSpan = artist?.["life-span"];
    return lifeSpan?.begin
      ? `${lifeSpan.begin.split("-")[0]} - ${lifeSpan.ended ? lifeSpan.end?.split("-")[0] : "Present"}`
      : null;
  }, [artist]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 pt-24">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="mb-8 h-8 w-32" />
            <div className="flex flex-col gap-8 md:flex-row">
              <Skeleton className="h-48 w-48 rounded-full" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 pt-24 text-center">
          <h1 className="mb-4 text-2xl font-bold">Artist not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden px-4 pb-12 pt-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="container relative mx-auto max-w-6xl">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{artist.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col items-start gap-8 md:flex-row">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="gradient-border flex h-48 w-48 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary"
            >
              <ArtistPageAvatar artist={artist} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              {artist.type ? (
                <span className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                  {artist.type}
                </span>
              ) : null}

              <h1 className="mb-4 text-4xl font-bold md:text-5xl">{artist.name}</h1>

              {artist.disambiguation ? (
                <p className="mb-4 text-lg text-muted-foreground">{artist.disambiguation}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                {artist.country ? (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {artist.country}
                  </span>
                ) : null}
                {yearsActive ? (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {yearsActive}
                  </span>
                ) : null}
                {albums.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <Disc3 className="h-4 w-4" />
                    {albums.length} albums
                  </span>
                ) : null}
              </div>

              <a
                href={`https://musicbrainz.org/artist/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-primary hover:underline"
              >
                View on MusicBrainz
                <ExternalLink className="h-4 w-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="container mx-auto max-w-6xl">
          <h2 className="mb-8 text-2xl font-bold">Discography</h2>

          {albums.length > 0 ? (
            <>
              {(() => {
                const sortByYear = (items: typeof albums) =>
                  [...items].sort((left, right) => {
                    const yearLeft = left["first-release-date"]?.split("-")[0] || "9999";
                    const yearRight = right["first-release-date"]?.split("-")[0] || "9999";
                    return yearLeft.localeCompare(yearRight);
                  });

                const officialAlbums = sortByYear(
                  albums.filter(
                    (entry) =>
                      entry["primary-type"] === "Album" &&
                      (!entry["secondary-types"] || entry["secondary-types"].length === 0),
                  ),
                );
                const eps = sortByYear(albums.filter((entry) => entry["primary-type"] === "EP"));
                const others = sortByYear(
                  albums.filter((entry) => {
                    if (entry["primary-type"] === "EP") return false;
                    if (
                      entry["primary-type"] === "Album" &&
                      (!entry["secondary-types"] || entry["secondary-types"].length === 0)
                    ) {
                      return false;
                    }
                    return true;
                  }),
                );

                const otherTypes = [...new Set(others.map((entry) => entry["primary-type"] || "Unknown"))];
                const filteredOthers =
                  activeOtherFilters.size === 0
                    ? others
                    : others.filter((entry) =>
                        activeOtherFilters.has(entry["primary-type"] || "Unknown"),
                      );

                const toggleFilter = (type: string) => {
                  setActiveOtherFilters((current) => {
                    const next = new Set(current);
                    if (next.has(type)) next.delete(type);
                    else next.add(type);
                    return next;
                  });
                };

                const renderSection = (
                  title: string,
                  items: typeof albums,
                  startIndex: number,
                ) =>
                  items.length > 0 ? (
                    <div className="mb-12">
                      <h3 className="mb-5 text-xl font-semibold text-muted-foreground">
                        {title} ({items.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {items.map((album, index) => (
                          <AlbumCard
                            key={album.id}
                            album={{
                              id: album.id,
                              title: album.title,
                              artistName: artist.name,
                              releaseDate: album["first-release-date"],
                              type: album["primary-type"],
                            }}
                            index={startIndex + index}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null;

                return (
                  <>
                    {renderSection("Albums", officialAlbums, 0)}
                    {renderSection("EPs", eps, officialAlbums.length)}

                    {others.length > 0 ? (
                      <div className="mb-12">
                        <h3 className="mb-4 text-xl font-semibold text-muted-foreground">
                          Other Releases ({filteredOthers.length})
                        </h3>

                        <div className="mb-6 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveOtherFilters(new Set())}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                              activeOtherFilters.size === 0
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            All
                          </button>
                          {otherTypes.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleFilter(type)}
                              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                activeOtherFilters.has(type)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {filteredOthers.map((album, index) => (
                            <AlbumCard
                              key={album.id}
                              album={{
                                id: album.id,
                                title: album.title,
                                artistName: artist.name,
                                releaseDate: album["first-release-date"],
                                type: album["primary-type"],
                              }}
                              index={officialAlbums.length + eps.length + index}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="py-12 text-center">
              <Disc3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No releases found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ArtistPage;
