import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Disc3, ExternalLink, Music } from "lucide-react";

import { AlbumReviewPanel } from "@/components/music/AlbumReviewPanel";
import { TrackList } from "@/components/music/TrackList";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getCoverArtUrl,
  getRelease,
  getReleaseGroupReleases,
  type MusicBrainzRelease,
} from "@/lib/musicbrainz";

const AlbumPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [release, setRelease] = useState<MusicBrainzRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setIsLoading(true);

      try {
        const releases = await getReleaseGroupReleases(id);

        if (releases.length > 0) {
          const releaseDetails = await getRelease(releases[0].id);
          setRelease(releaseDetails);
        }
      } catch (error) {
        console.error("Error fetching album:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  useEffect(() => {
    const fetchRating = async () => {
      if (!user || !id) return;
      const { data } = await supabase
        .from("album_ratings")
        .select("rating")
        .eq("user_id", user.id)
        .eq("album_mbid", id)
        .maybeSingle();

      if (data) {
        setUserRating(data.rating);
      }
    };

    void fetchRating();
  }, [id, user]);

  const handleAlbumScoreChange = useCallback(
    async (score: number | null) => {
      if (!user || !id || !release || score === null) {
        if (score === null) setUserRating(0);
        return;
      }

      const roundedScore = Math.round(score * 10) / 10;
      setUserRating(roundedScore);

      try {
        const artistName = release["artist-credit"]?.[0]?.artist.name;
        const coverUrl = getCoverArtUrl(id, "500");

        const { error } = await supabase.from("album_ratings").upsert(
          {
            user_id: user.id,
            album_mbid: id,
            album_title: release.title,
            artist_name: artistName,
            cover_url: coverUrl,
            rating: Math.round(roundedScore),
            rated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,album_mbid",
          },
        );

        if (error) throw error;
      } catch (error) {
        console.error("Error saving album score:", error);
        toast({
          title: "Could not save album score",
          description: "Track ratings were saved, but the aggregate score did not update.",
          variant: "destructive",
        });
      }
    },
    [id, release, toast, user],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 pt-24">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="mb-8 h-8 w-32" />
            <div className="flex flex-col gap-8 md:flex-row">
              <Skeleton className="h-72 w-72 rounded-2xl" />
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

  if (!release) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="px-4 pt-24 text-center">
          <h1 className="mb-4 text-2xl font-bold">Album not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const artistName = release["artist-credit"]?.[0]?.artist.name;
  const artistId = release["artist-credit"]?.[0]?.artist.id;
  const tracks = release.media?.[0]?.tracks || [];
  const coverUrl = id ? getCoverArtUrl(id, "500") : "";

  return (
    <div className="min-h-screen bg-background pb-24">
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
              {artistId && artistName ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/artist/${artistId}`}>{artistName}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              ) : null}
              <BreadcrumbItem>
                <BreadcrumbPage>{release.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col items-start gap-8 md:flex-row">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="glow-primary h-72 w-72 flex-shrink-0 overflow-hidden rounded-2xl bg-secondary"
            >
              {!imageError ? (
                <img
                  src={coverUrl}
                  alt={release.title}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Disc3 className="h-24 w-24 animate-float text-muted-foreground" />
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-1"
            >
              {release["release-group"]?.["primary-type"] ? (
                <span className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-sm text-muted-foreground">
                  {release["release-group"]["primary-type"]}
                </span>
              ) : null}

              <h1 className="mb-2 text-4xl font-bold md:text-5xl">{release.title}</h1>

              {artistName ? (
                <Link
                  to={`/artist/${artistId}`}
                  className="text-xl text-muted-foreground transition-colors hover:text-primary"
                >
                  {artistName}
                </Link>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-4 text-muted-foreground">
                {release.date ? (
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {release.date}
                  </span>
                ) : null}
                {tracks.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    {tracks.length} tracks
                  </span>
                ) : null}
              </div>

              <div className="mt-8">
                <h3 className="mb-2 text-lg font-semibold">Album Score</h3>
                {userRating > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="gradient-text text-3xl font-bold">{userRating}/10</span>
                    <span className="text-sm text-muted-foreground">
                      avg of your track ratings
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {user ? (
                      "Rate individual tracks below to generate your album score"
                    ) : (
                      <>
                        <Link to="/auth" className="text-primary hover:underline">
                          Sign in
                        </Link>{" "}
                        to rate tracks and build your discography map
                      </>
                    )}
                  </p>
                )}
              </div>

              <a
                href={`https://musicbrainz.org/release/${release.id}`}
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

      <section className="px-4 pb-10">
        <div className="container mx-auto max-w-6xl">
          <AlbumReviewPanel
            albumMbid={id!}
            albumTitle={release.title}
            artistName={artistName}
            coverUrl={coverUrl}
            albumScore={userRating || undefined}
          />
        </div>
      </section>

      {tracks.length > 0 ? (
        <section className="px-4 pb-10">
          <div className="container mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Tracks</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Keep the play button exactly where it is, then open details or send any
                  track straight into a playlist.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-border/50 bg-card/50 p-4">
              <TrackList
                tracks={tracks}
                albumMbid={id!}
                artistName={artistName}
                albumTitle={release.title}
                onAlbumScoreChange={handleAlbumScoreChange}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default AlbumPage;
