import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TRACK_RATING_CRITERIA,
  sanitizeTrackRatingCriteria,
  type TrackRatingCriterion,
} from "@/lib/ratingCriteria";

export function useTrackRatingPreferences() {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<TrackRatingCriterion[]>(DEFAULT_TRACK_RATING_CRITERIA);
  const [isLoading, setIsLoading] = useState(true);

  const ensurePreferences = useCallback(async () => {
    if (!user) {
      setCriteria(DEFAULT_TRACK_RATING_CRITERIA);
      setIsLoading(false);
      return DEFAULT_TRACK_RATING_CRITERIA;
    }

    setIsLoading(true);

    const { data, error } = await supabase
      .from("user_track_rating_settings")
      .select("criteria")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setCriteria(DEFAULT_TRACK_RATING_CRITERIA);
      setIsLoading(false);
      return DEFAULT_TRACK_RATING_CRITERIA;
    }

    if (!data) {
      const { data: created } = await supabase
        .from("user_track_rating_settings")
        .insert({
          user_id: user.id,
          criteria: DEFAULT_TRACK_RATING_CRITERIA,
        })
        .select("criteria")
        .single();

      const nextCriteria = sanitizeTrackRatingCriteria(created?.criteria);
      setCriteria(nextCriteria);
      setIsLoading(false);
      return nextCriteria;
    }

    const nextCriteria = sanitizeTrackRatingCriteria(data.criteria);
    setCriteria(nextCriteria);
    setIsLoading(false);
    return nextCriteria;
  }, [user]);

  useEffect(() => {
    void ensurePreferences();
  }, [ensurePreferences]);

  const saveCriteria = useCallback(
    async (nextCriteria: TrackRatingCriterion[]) => {
      if (!user) return DEFAULT_TRACK_RATING_CRITERIA;

      const sanitized = sanitizeTrackRatingCriteria(nextCriteria);

      const { error } = await supabase.from("user_track_rating_settings").upsert(
        {
          user_id: user.id,
          criteria: sanitized,
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) {
        throw error;
      }

      setCriteria(sanitized);
      return sanitized;
    },
    [user],
  );

  return {
    criteria,
    isLoading,
    refreshCriteria: ensurePreferences,
    saveCriteria,
  };
}
