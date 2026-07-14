import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Disc3, User, MapPin, Calendar, Music2, ArrowRight, RefreshCw } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { AlbumCard } from "@/components/music/AlbumCard";
import { getArtist, pickArtistImage, type DeezerArtist, type DeezerAlbum } from "@/lib/deezer";
import { buildDiscography, sortByReleaseDateAsc, type ClassifiedAlbum } from "@/lib/discography";
import { getArtistTags } from "@/lib/lastfm";
import { getArtistDiscography } from "@/lib/musicPipeline";
import { resolveGenres } from "@/lib/genreMap";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type OtherTab = "all" | "single" | "album" | "compilation";
type SecondaryTab = "discography" | "popular" | "bio" | "similar";

// ОНОВЛЕНО: Тепер функція сортування враховує original_year, якщо він існує
function chronoSort<T extends { release_date?: string; original_year?: number | string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ta = a.original_year
      ? new Date(`${a.original_year}-01-01`).getTime()
      : new Date(a.release_date ?? "9999-12-31").getTime();

    const tb = b.original_year
      ? new Date(`${b.original_year}-01-01`).getTime()
      : new Date(b.release_date ?? "9999-12-31").getTime();

    return ta - tb;
  });
}

/** Semicircular radial gauge — animated on load. */
function RadialScoreGauge({ score, rated, total }: { score: number; rated: number; total: number }) {
  const pct = Math.max(0, Math.min(1, score / 10));
  const radius = 100;
  const cx = 120;
  const cy = 120;
  const circumference = Math.PI * radius;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative w-full max-w-[280px] mx-auto">
      <svg viewBox="0 0 240 140" className="w-full h-auto">
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground mb-1">Average score</p>
        <p className="text-4xl font-bold leading-none">
          {score.toFixed(1)}
          <span className="text-muted-foreground text-2xl">/10</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Rated albums: {rated}/{total}
        </p>
      </div>
    </div>
  );
}

const ArtistPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [artist, setArtist] = useState<DeezerArtist | null>(null);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const [wikidataGenres, setWikidataGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const [isLoadingArtist, setIsLoadingArtist] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [otherTab, setOtherTab] = useState<OtherTab>("all");
  const [activeTab, setActiveTab] = useState<SecondaryTab>("discography");
  const discoRef = useRef<HTMLDivElement>(null);

  const handleForceRefresh = async () => {
    if (!id || isRefreshing) return;
    setIsRefreshing(true);
    setIsLoadingAlbums(true);
    try {
      const payload = await getArtistDiscography(id, artist?.name, { forceRefresh: true });
      setAlbums(payload.albums);
      setWikidataGenres(payload.wikidata_genres);
    } catch (err) {
      console.error("[ArtistPage] force refresh failed:", err);
    } finally {
      setIsLoadingAlbums(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setIsLoadingArtist(true);
    setIsLoadingAlbums(true);
    setArtist(null);
    setAlbums([]);
    setTags([]);
    setOtherTab("all");
    setActiveTab("discography");

    let resolvedArtistName: string | null = null;

    getArtist(id).then((data) => {
      if (cancelled) return;
      setArtist(data);
      setIsLoadingArtist(false);
      resolvedArtistName = data?.name ?? null;

      if (data?.name) {
        getArtistTags(id, data.name).then((t) => {
          if (!cancelled) setTags(t);
        });
      }
    });

    // New pipeline: Wikidata-primary chronology + genres, Deezer as data layer,
    // result cached in Supabase `music_cache` for 30 days. Fully awaited here
    // because the payload arrives from the cache in a single query on warm
    // hits — cold hits fan out Wikidata calls internally.
    (async () => {
      const payload = await getArtistDiscography(
        id,
        resolvedArtistName ?? undefined,
      );
      if (cancelled) return;
      setAlbums(payload.albums);
      setWikidataGenres(payload.wikidata_genres);
      setIsLoadingAlbums(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch this user's ratings for any of the artist's albums
  useEffect(() => {
    if (!user || !artist) return;
    let cancelled = false;

    supabase
      .from("album_ratings")
      .select("album_deezer_id, rating")
      .eq("user_id", user.id)
      .eq("artist_name", artist.name)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map: Record<string, number> = {};
        data.forEach((r) => {
          if (r.album_deezer_id) map[String(r.album_deezer_id)] = r.rating;
        });
        setRatings(map);
      });

    return () => {
      cancelled = true;
    };
  }, [user, artist]);

  const artistImage = artist ? pickArtistImage(artist) : null;

  const discography = useMemo(() => {
    if (!artist) return null;
    const d = buildDiscography(albums, artist.id);
    return {
      studioAlbums: chronoSort(d.studioAlbums),
      eps: chronoSort(d.eps),
      singles: d.singles,
      collaborations: chronoSort(d.collaborations),
      live: d.live,
      compilations: d.compilations,
    };
  }, [albums, artist]);

  const otherReleases = useMemo(() => {
    const empty = { all: [], single: [], album: [], compilation: [] } as Record<OtherTab, ClassifiedAlbum[]>;
    if (!discography) return empty;

    return {
      single: discography.singles,
      album: discography.live, // "live" releases live under Other > Album bucket
      compilation: discography.compilations,
      all: sortByReleaseDateAsc([...discography.singles, ...discography.live, ...discography.compilations]),
    };
  }, [discography]);

  const { activeYears, country, totalAlbums } = useMemo(() => {
    // ОНОВЛЕНО: Тепер обчислення років активності також пріоритетно враховує original_year
    const years = (discography?.studioAlbums ?? [])
      .map((a: any) => {
        if (a.original_year) return Number(a.original_year);
        return a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : NaN;
      })
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    const first = years[0];
    const last = years[years.length - 1];
    const now = new Date().getFullYear();

    const active = first
      ? last && last >= now - 3
        ? `${first}–present`
        : last
          ? `${first}–${last}`
          : `${first}`
      : null;

    return {
      activeYears: active,
      country: null as string | null, // Deezer artist payload doesn't expose country reliably
      totalAlbums: discography?.studioAlbums.length ?? 0,
    };
  }, [discography]);

  const { avgScore, ratedCount } = useMemo(() => {
    if (!discography) return { avgScore: 0, ratedCount: 0 };
    const ids = discography.studioAlbums.map((a) => String(a.id));
    const rated = ids.map((id) => ratings[id]).filter((r): r is number => typeof r === "number");
    const avg = rated.length ? rated.reduce((s, v) => s + v, 0) / rated.length : 0;
    return { avgScore: avg, ratedCount: rated.length };
  }, [discography, ratings]);

  if (isLoadingArtist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4">
          <div className="container mx-auto max-w-[1440px]">
            <Skeleton className="h-8 w-32 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
              <div className="flex gap-6">
                <Skeleton className="w-56 h-56 rounded-2xl" />
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-12 w-64" />
                  <Skeleton className="h-6 w-48" />
                </div>
              </div>
              <Skeleton className="h-56 rounded-2xl" />
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
        <div className="pt-24 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Artist not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const renderSection = (title: string, items: ClassifiedAlbum[], startIndex: number) =>
    items.length > 0 && (
      <section className="mb-12">
        <h3 className="text-xl md:text-2xl font-semibold mb-6">
          {title} <span className="text-muted-foreground font-normal">({items.length})</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6">
          {items.map((album, index) => {
            const ratingForCard = ratings[String(album.id)];
            return (
              <AlbumCard
                key={album.id}
                album={{ ...album, artist: { id: artist.id, name: artist.name } }}
                index={startIndex + index}
                rating={ratingForCard}
                showRating={typeof ratingForCard === "number"}
              />
            );
          })}
        </div>
      </section>
    );

  const studioCount = discography?.studioAlbums.length ?? 0;
  const epCount = discography?.eps.length ?? 0;
  const otherTotal = otherReleases.all.length;
  const visibleOther = otherReleases[otherTab];

  const hasAnyRelease = studioCount + epCount + otherTotal > 0;

  const otherTabs: Array<{ id: OtherTab; label: string; count: number }> = [
    { id: "all", label: "All", count: otherReleases.all.length },
    { id: "single", label: "Single", count: otherReleases.single.length },
    { id: "album", label: "Album", count: otherReleases.album.length },
    { id: "compilation", label: "Compilation", count: otherReleases.compilation.length },
  ];

  const secondaryTabs: Array<{ id: SecondaryTab; label: string }> = [
    { id: "discography", label: "Discography" },
    { id: "popular", label: "Popular Songs" },
    { id: "bio", label: "Bio" },
    { id: "similar", label: "Similar Artists" },
  ];

  // Wikidata P136 is our primary genre source; Last.fm tags are the fallback.
  const genres = resolveGenres(
    wikidataGenres.length > 0 ? wikidataGenres : tags,
    5,
    artist.name,
  );
  const artistType = (artist.type ?? "artist").toLowerCase() === "artist" ? "Artist" : "Group";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24 px-4">
        <div className="container mx-auto max-w-[1440px]">
          <Breadcrumb className="mb-6">
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

          {/* HERO */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6 lg:gap-10 items-stretch mb-8">
            {/* Left: image + meta */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45 }}
                className="w-full md:w-64 aspect-square rounded-2xl bg-secondary overflow-hidden flex-shrink-0 border border-border/40"
              >
                {artistImage ? (
                  <img src={artistImage} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-20 h-20 text-muted-foreground" />
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="flex-1 min-w-0 flex flex-col justify-center"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground mb-2">{artistType}</p>
                <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] mb-4 break-words">{artist.name}</h1>

                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {genres.map((g) => (
                      <Link key={g.slug} to={`/genre/${encodeURIComponent(g.slug)}`}>
                        <Badge
                          variant="secondary"
                          className="rounded-full border border-border/60 bg-secondary/60 hover:bg-secondary text-foreground text-xs px-3 py-1 font-normal cursor-pointer"
                        >
                          {g.label}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {country && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" /> {country}
                    </span>
                  )}
                  {activeYears && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" /> {activeYears}
                    </span>
                  )}
                  {totalAlbums > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Disc3 className="w-4 h-4" /> {totalAlbums} Albums
                    </span>
                  )}
                  {typeof artist.nb_fan === "number" && artist.nb_fan > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Music2 className="w-4 h-4" /> {artist.nb_fan.toLocaleString()} fans
                    </span>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Right: analytics card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="rounded-2xl border border-border/50 bg-card p-6 flex flex-col justify-between"
            >
              <RadialScoreGauge score={avgScore} rated={ratedCount} total={totalAlbums} />

              <Link
                to={`/dashboard/rated-music/${encodeURIComponent(artist.name)}`}
                className="mt-4 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                See all statistics
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </section>

          {/* SECONDARY TABS */}
          <div className="sticky top-16 z-30 -mx-4 px-4 bg-background/85 backdrop-blur border-b border-border/50">
            <div role="tablist" aria-label="Artist sections" className="flex items-center gap-6 overflow-x-auto">
              {secondaryTabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "discography") {
                        discoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    className={`relative py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    {active && (
                      <motion.span
                        layoutId="artist-tab-underline"
                        className="absolute left-0 right-0 -bottom-px h-0.5 bg-foreground rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB CONTENT */}
          <div ref={discoRef} className="py-10">
            {activeTab === "discography" && (
              <>
                {isLoadingAlbums || !discography ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="aspect-square rounded-2xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : hasAnyRelease ? (
                  <>
                    {renderSection("Albums", discography.studioAlbums, 0)}
                    {renderSection("LP", discography.eps, studioCount)}

                    {otherTotal > 0 && (
                      <section className="mb-12">
                        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                          <h3 className="text-xl md:text-2xl font-semibold">
                            Other Releases <span className="text-muted-foreground font-normal">({otherTotal})</span>
                          </h3>
                          <div role="tablist" aria-label="Filter other releases" className="flex flex-wrap gap-2">
                            {otherTabs.map((tab) => {
                              const disabled = tab.id !== "all" && tab.count === 0;
                              const active = otherTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  role="tab"
                                  type="button"
                                  aria-selected={active}
                                  disabled={disabled}
                                  onClick={() => setOtherTab(tab.id)}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    active
                                      ? "bg-foreground text-background"
                                      : disabled
                                        ? "bg-secondary/40 text-muted-foreground/40 cursor-not-allowed"
                                        : "bg-secondary text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {visibleOther.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 md:gap-6">
                            {visibleOther.map((album, index) => {
                              const ratingForCard = ratings[String(album.id)];
                              return (
                                <AlbumCard
                                  key={album.id}
                                  album={{ ...album, artist: { id: artist.id, name: artist.name } }}
                                  index={studioCount + epCount + index}
                                  rating={ratingForCard}
                                  showRating={typeof ratingForCard === "number"}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-6">No releases in this category.</p>
                        )}
                      </section>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Disc3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No releases found</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "popular" && (
              <div className="py-20 text-center text-muted-foreground">
                <Music2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Popular songs coming soon.
              </div>
            )}

            {activeTab === "bio" && (
              <div className="py-20 text-center text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Biography coming soon.
              </div>
            )}

            {activeTab === "similar" && (
              <div className="py-20 text-center text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Similar artists coming soon.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistPage;
