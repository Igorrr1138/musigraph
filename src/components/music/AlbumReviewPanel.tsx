import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ALBUM_MOOD_OPTIONS } from "@/lib/ratingCriteria";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AlbumReviewPanelProps {
  albumMbid: string;
  albumTitle: string;
  artistName?: string;
  coverUrl?: string | null;
  albumScore?: number;
}

export function AlbumReviewPanel({
  albumMbid,
  albumTitle,
  artistName,
  coverUrl,
  albumScore,
}: AlbumReviewPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [review, setReview] = useState("");
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchReview = async () => {
      if (!user) {
        setReview("");
        setMoodTags([]);
        return;
      }

      const { data, error } = await supabase
        .from("album_reviews")
        .select("review, mood_tags")
        .eq("user_id", user.id)
        .eq("album_mbid", albumMbid)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error(error);
        return;
      }

      setReview(data?.review ?? "");
      setMoodTags(Array.isArray(data?.mood_tags) ? data.mood_tags : []);
    };

    void fetchReview();

    return () => {
      isMounted = false;
    };
  }, [albumMbid, user]);

  const toggleMood = (mood: string) => {
    setMoodTags((previous) =>
      previous.includes(mood)
        ? previous.filter((entry) => entry !== mood)
        : [...previous, mood],
    );
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save album reviews.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase.from("album_reviews").upsert(
        {
          user_id: user.id,
          album_mbid: albumMbid,
          album_title: albumTitle,
          artist_name: artistName ?? null,
          cover_url: coverUrl ?? null,
          review: review.trim() || null,
          mood_tags: moodTags,
        },
        {
          onConflict: "user_id,album_mbid",
        },
      );

      if (error) throw error;

      toast({
        title: "Album review saved",
        description: "Your notes and mood tags are locked in.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not save album review",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-border/60 bg-card/70 p-6 shadow-[0_32px_90px_-48px_hsl(var(--background))]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Album Review
          </div>
          <h3 className="mt-4 text-2xl font-semibold">Mood and notes for this record</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Capture the emotional pull of the album while your track ratings handle the
            structural score.
          </p>
        </div>

        {albumScore ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Aggregate score
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">{albumScore}/10</p>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Mood tags
        </p>
        <div className="flex flex-wrap gap-2">
          {ALBUM_MOOD_OPTIONS.map((mood) => {
            const isSelected = moodTags.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() => toggleMood(mood)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Review
        </p>
        <Textarea
          value={review}
          onChange={(event) => setReview(event.target.value)}
          placeholder="Write what this album feels like, where it peaks, and which tracks carry the identity."
          className="min-h-[180px] border-border/60 bg-background/60"
        />
      </div>

      <Button
        type="button"
        disabled={isSaving}
        onClick={() => void handleSave()}
        className="mt-6 gradient-bg text-primary-foreground border-0"
      >
        Save Album Review
      </Button>
    </div>
  );
}
