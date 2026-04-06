import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, SlidersHorizontal, Trash2 } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTrackRatingPreferences } from "@/hooks/useTrackRatingPreferences";
import {
  createCriterion,
  DEFAULT_TRACK_RATING_CRITERIA,
  moveCriterion,
  sanitizeTrackRatingCriteria,
  type TrackRatingCriterion,
} from "@/lib/ratingCriteria";

const AccountSettingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { criteria, isLoading, saveCriteria } = useTrackRatingPreferences();
  const [draftCriteria, setDraftCriteria] = useState<TrackRatingCriterion[]>(criteria);
  const [newCriterionLabel, setNewCriterionLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    setDraftCriteria(criteria);
  }, [criteria]);

  const enabledCount = useMemo(
    () => draftCriteria.filter((criterion) => criterion.enabled).length,
    [draftCriteria],
  );

  const handleAddCriterion = () => {
    const nextCriterion = createCriterion(newCriterionLabel);
    if (!nextCriterion) return;

    if (draftCriteria.some((criterion) => criterion.id === nextCriterion.id)) {
      toast({
        title: "Criterion already exists",
        description: "Try a different label or rename the existing one.",
        variant: "destructive",
      });
      return;
    }

    setDraftCriteria((current) => [...current, nextCriterion]);
    setNewCriterionLabel("");
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const sanitized = sanitizeTrackRatingCriteria(draftCriteria);
      await saveCriteria(sanitized);
      toast({
        title: "Settings saved",
        description: "Your deep-rating criteria are updated.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not save settings",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="px-4 pt-24">
        <div className="container mx-auto max-w-5xl">
          <Link
            to="/ratings"
            className="mb-8 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to ratings
          </Link>

          <div className="rounded-[32px] border border-border/60 bg-card/70 p-8 shadow-[0_32px_90px_-48px_hsl(var(--background))]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Account settings
                </div>
                <h1 className="mt-4 text-4xl font-bold">Deep rating criteria</h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  Choose which song criteria appear in each track details panel. Reorder
                  them, turn them off, or create your own labels.
                </p>
              </div>

              <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Active criteria
                </p>
                <p className="mt-1 text-3xl font-bold text-primary">{enabledCount}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                {(isLoading ? criteria : draftCriteria).map((criterion, index) => (
                  <div
                    key={criterion.id}
                    className="rounded-2xl border border-border/50 bg-background/50 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{criterion.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {criterion.id}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-border/50 px-3 py-1.5">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Show
                          </span>
                          <Switch
                            checked={criterion.enabled}
                            onCheckedChange={(enabled) =>
                              setDraftCriteria((current) =>
                                current.map((entry) =>
                                  entry.id === criterion.id ? { ...entry, enabled } : entry,
                                ),
                              )
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full"
                          disabled={index === 0}
                          onClick={() =>
                            setDraftCriteria((current) => moveCriterion(current, index, -1))
                          }
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full"
                          disabled={index === draftCriteria.length - 1}
                          onClick={() =>
                            setDraftCriteria((current) => moveCriterion(current, index, 1))
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>

                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDraftCriteria((current) =>
                              current.filter((entry) => entry.id !== criterion.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                  <h2 className="text-lg font-semibold">Add custom criterion</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a new lens for your track analysis, like “atmosphere” or
                    “riff work”.
                  </p>

                  <div className="mt-4 flex gap-3">
                    <Input
                      value={newCriterionLabel}
                      onChange={(event) => setNewCriterionLabel(event.target.value)}
                      placeholder="Atmosphere"
                    />
                    <Button type="button" onClick={handleAddCriterion} className="gradient-bg text-primary-foreground border-0">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                  <h2 className="text-lg font-semibold">Quick reset</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Roll back to the original Figma criteria set at any time.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDraftCriteria(DEFAULT_TRACK_RATING_CRITERIA)}
                  >
                    Restore defaults
                  </Button>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/50 p-5">
                  <h2 className="text-lg font-semibold">Preview</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {draftCriteria
                      .filter((criterion) => criterion.enabled)
                      .map((criterion) => (
                        <span
                          key={criterion.id}
                          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary"
                        >
                          {criterion.label}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className="gradient-bg border-0 text-primary-foreground"
              >
                Save Settings
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraftCriteria(criteria)}
              >
                Undo local changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
