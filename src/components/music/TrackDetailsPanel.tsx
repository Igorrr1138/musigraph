import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookAudio, SlidersHorizontal } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTrackRatingPreferences } from "@/hooks/useTrackRatingPreferences";
import { supabase } from "@/integrations/supabase/client";
import { fetchLyrics } from "@/lib/lyrics";
import {
  getCriteriaAverage,
  getEnabledCriteria,
  sanitizeCriteriaRatings,
  type CriteriaRatingMap,
} from "@/lib/ratingCriteria";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface TrackDetailsPanelProps {
  track: {
    id: string;
    title: string;
    position: number;
    length?: number;
  };
  albumMbid: string;
  artistName?: string;
  albumTitle?: string;
}

export function TrackDetailsPanel({
  track,
  albumMbid,
  artistName,
  albumTitle,
}: TrackDetailsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { criteria, isLoading: criteriaLoading } = useTrackRatingPreferences();
  const [criteriaRatings, setCriteriaRatings] = useState<CriteriaRatingMap>({});
  const [review, setReview] = useState("");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const enabledCriteria = useMemo(() => getEnabledCriteria(criteria), [criteria]);
  const criteriaAverage = useMemo(() => getCriteriaAverage(criteriaRatings), [criteriaRatings]);

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      if (!user) {
        setCriteriaRatings({});
        setReview("");
        return;
      }

      const { data, error } = await supabase
        .from("track_details")
        .select("criteria_ratings, review")
        .eq("user_id", user.id)
        .eq("album_mbid", albumMbid)
        .eq("track_position", track.position)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error(error);
        return;
      }

      setCriteriaRatings(sanitizeCriteriaRatings(data?.criteria_ratings));
      setReview(data?.review ?? "");
    };

    void loadDetails();

    return () => {
      isMounted = false;
    };
  }, [albumMbid, track.position, user]);

  useEffect(() => {
    let isMounted = true;

    const loadLyrics = async () => {
      if (!artistName || !track.title) {
        setLyrics(null);
        return;
      }

      setLyricsLoading(true);
      const nextLyrics = await fetchLyrics(artistName, track.title);

      if (!isMounted) return;
      setLyrics(nextLyrics);
      setLyricsLoading(false);
    };

    void loadLyrics();

    return () => {
      isMounted = false;
    };
  }, [artistName, track.title]);

  const handleCriteriaChange = (criterionId: string, rating: number) => {
    setCriteriaRatings((previous) => ({
      ...previous,
      [criterionId]: rating,
    }));
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save track details.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase.from("track_details").upsert(
        {
          user_id: user.id,
          album_mbid: albumMbid,
          album_title: albumTitle ?? null,
          artist_name: artistName ?? null,
          track_mbid: track.id || null,
          track_title: track.title,
          track_position: track.position,
          criteria_ratings: criteriaRatings,
          review: review.trim() || null,
        },
        {
          onConflict: "user_id,album_mbid,track_position",
        },
      );

      if (error) throw error;

      toast({
        title: "Track details saved",
        description: "Your deep rating and notes are updated.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not save track details",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-background/60 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Song Details
          </p>
          <h4 className="mt-2 text-lg font-semibold">{track.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Deep rating, lyrics and review all live here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {criteriaAverage ? (
            <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Criteria Avg {criteriaAverage}/10
            </div>
          ) : null}
          <Button asChild variant="outline" size="sm" className="border-border/60">
            <Link to="/settings/account">
              <SlidersHorizontal className="h-4 w-4" />
              Customize criteria
            </Link>
          </Button>
        </div>
      </div>

      <Separator className="my-5 bg-border/50" />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h5 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Deep Criteria
              </h5>
              {criteriaLoading ? (
                <span className="text-xs text-muted-foreground">Loading criteria...</span>
              ) : null}
            </div>

            <div className="space-y-4">
              {enabledCriteria.length ? (
                enabledCriteria.map((criterion) => {
                  const currentValue = criteriaRatings[criterion.id];

                  return (
                    <div
                      key={criterion.id}
                      className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <span className="font-medium">{criterion.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {currentValue ? `${currentValue}/10` : "Not set"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 10 }, (_, index) => {
                          const value = index + 1;
                          const isActive = currentValue === value;

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleCriteriaChange(criterion.id, value)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                                isActive
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                  All deep-rating criteria are currently disabled. Turn some back on in
                  Account settings.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h5 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Review
              </h5>
              <span className="text-xs text-muted-foreground">
                Personal notes for this track
              </span>
            </div>

            <Textarea
              value={review}
              onChange={(event) => setReview(event.target.value)}
              placeholder="Write what hit, what dragged, and what you want to remember about this song."
              className="min-h-[140px] border-border/60 bg-background/60"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <BookAudio className="h-4 w-4 text-primary" />
            Lyrics
          </div>

          <div className="mt-4 rounded-2xl border border-border/50 bg-background/50 p-4">
            {lyricsLoading ? (
              <p className="text-sm text-muted-foreground">Loading lyrics...</p>
            ) : lyrics ? (
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
                {lyrics}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Lyrics are not available for this track yet.
              </p>
            )}
          </div>

          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="mt-5 w-full gradient-bg text-primary-foreground border-0"
          >
            Save Details
          </Button>
        </div>
      </div>
    </div>
  );
}
