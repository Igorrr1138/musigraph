import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, Loader2, Settings2, X, GripVertical } from 'lucide-react';
import type { DeezerTrack } from '@/lib/deezer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/* ------------------------------- constants ------------------------------- */

export const CRITERIA_LIBRARY: Record<string, string> = {
  lyrics: 'Lyrics',
  instrumental: 'Instrumental part',
  energy: 'Energy',
  complexity: 'Complexity',
  mood: 'Mood',
  flow: 'Flow',
  originality: 'Originality',
  production: 'Production',
  emotion: 'Emotion',
  replayability: 'Replayability',
  dynamics: 'Dynamics',
  atmosphere: 'Atmosphere',
  technical: 'Technical skill',
  memorability: 'Memorability',
};

const DEFAULT_VISIBLE = ['lyrics', 'instrumental', 'energy', 'complexity', 'mood'];
const MAX_VISIBLE = 8;
const REVIEW_MAX = 500;

const sb = supabase as any;

/* ------------------------------- helpers --------------------------------- */

type MetadataSection = { role: string; name: string };
type Metadata = {
  release_type?: string;
  composition?: MetadataSection[];
  production?: MetadataSection[];
  performers?: MetadataSection[];
};

type SyncedLine = { line: string; start_ms?: number; end_ms?: number };

/* =========================================================================
   Component
   ========================================================================= */

interface SongDetailsProps {
  track: DeezerTrack;
  albumDeezerId: string;
  albumCover: string | null;
  artistName?: string;
  onClose: () => void;
}

export function SongDetails({
  track,
  albumDeezerId,
  albumCover,
  artistName,
  onClose,
}: SongDetailsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const trackId = String(track.id);

  /* ----- prefs ----- */
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [order, setOrder] = useState<string[]>(DEFAULT_VISIBLE);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  /* ----- criteria scores ----- */
  const [scores, setScores] = useState<Record<string, number>>({});
  const [communityScores, setCommunityScores] = useState<Record<string, number>>({});
  const [showCommunity, setShowCommunity] = useState(true);

  /* ----- review ----- */
  const reviewDraftKey = `track_review_draft_${trackId}`;
  const [review, setReview] = useState('');
  const [reviewSavedAt, setReviewSavedAt] = useState<Date | null>(null);

  /* ----- meta & lyrics ----- */
  const [metadata, setMetadata] = useState<Metadata>({});
  const [lyrics, setLyrics] = useState<{ plain?: string; synced?: SyncedLine[] } | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(true);

  /* ----- ui state ----- */
  const [saving, setSaving] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [textSize, setTextSize] = useState(16);

  /* ---------------------------- load on mount ---------------------------- */

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // criteria preferences
      if (user) {
        const { data: prefs } = await sb
          .from('criteria_preferences')
          .select('visible_criteria, criteria_order')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled && prefs) {
          const v = (prefs.visible_criteria as string[] | null) || DEFAULT_VISIBLE;
          const o = (prefs.criteria_order as string[] | null) || v;
          setVisible(v);
          setOrder(o.filter((k) => v.includes(k)).concat(v.filter((k) => !o.includes(k))));
        }
      }
      if (!cancelled) setPrefsLoaded(true);

      // user scores
      if (user) {
        const { data: tc } = await sb
          .from('track_criteria')
          .select('scores')
          .eq('user_id', user.id)
          .eq('track_deezer_id', trackId)
          .maybeSingle();
        if (!cancelled && tc?.scores) setScores(tc.scores as Record<string, number>);

        // user review
        const { data: tr } = await sb
          .from('track_reviews')
          .select('review, updated_at')
          .eq('user_id', user.id)
          .eq('track_deezer_id', trackId)
          .maybeSingle();
        if (!cancelled) {
          if (tr) {
            setReview(tr.review ?? '');
            if (tr.updated_at) setReviewSavedAt(new Date(tr.updated_at));
          } else {
            const draft = localStorage.getItem(reviewDraftKey);
            if (draft) setReview(draft);
          }
        }
      } else {
        const draft = localStorage.getItem(reviewDraftKey);
        if (draft && !cancelled) setReview(draft);
      }

      // shared metadata
      const { data: md } = await sb
        .from('track_metadata')
        .select('metadata')
        .eq('track_deezer_id', trackId)
        .maybeSingle();
      if (!cancelled && md?.metadata) setMetadata(md.metadata as Metadata);

      // lyrics
      setLyricsLoading(true);
      const { data: ly } = await sb
        .from('track_lyrics')
        .select('plain_text, synced')
        .eq('track_deezer_id', trackId)
        .maybeSingle();
      if (!cancelled) {
        if (ly) setLyrics({ plain: ly.plain_text ?? undefined, synced: (ly.synced as SyncedLine[]) ?? undefined });
        setLyricsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, trackId, reviewDraftKey]);

  /* ----- autosave review draft ----- */
  useEffect(() => {
    localStorage.setItem(reviewDraftKey, review);
  }, [review, reviewDraftKey]);

  /* ----------------------------- handlers ------------------------------- */

  const updateScore = useCallback((key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: Math.max(1, Math.min(10, Math.round(value))) }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to save your song details.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const ops: Promise<any>[] = [];
      ops.push(
        sb.from('track_criteria').upsert(
          {
            user_id: user.id,
            track_deezer_id: trackId,
            album_deezer_id: albumDeezerId,
            scores,
          },
          { onConflict: 'user_id,track_deezer_id' },
        ),
      );
      ops.push(
        sb.from('track_reviews').upsert(
          {
            user_id: user.id,
            track_deezer_id: trackId,
            album_deezer_id: albumDeezerId,
            review: review.slice(0, REVIEW_MAX),
          },
          { onConflict: 'user_id,track_deezer_id' },
        ),
      );
      ops.push(
        sb.from('criteria_preferences').upsert(
          {
            user_id: user.id,
            visible_criteria: visible,
            criteria_order: order,
          },
          { onConflict: 'user_id' },
        ),
      );
      const results = await Promise.all(ops);
      const err = results.find((r) => r?.error)?.error;
      if (err) throw err;
      setReviewSavedAt(new Date());
      localStorage.removeItem(reviewDraftKey);
      toast({ title: 'Saved' });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [user, trackId, albumDeezerId, scores, review, visible, order, reviewDraftKey, toast]);

  /* ----- gear helpers ----- */
  const toggleCriterion = (key: string) => {
    setVisible((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key);
        setOrder((o) => o.filter((k) => k !== key));
        return next;
      }
      if (prev.length >= MAX_VISIBLE) {
        toast({ title: `Max ${MAX_VISIBLE} criteria visible` });
        return prev;
      }
      setOrder((o) => [...o, key]);
      return [...prev, key];
    });
  };

  const moveCriterion = (key: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  /* ----- radar data ----- */
  const radarData = useMemo(() => {
    const keys = order.filter((k) => visible.includes(k));
    return keys.map((k) => ({
      criterion: CRITERIA_LIBRARY[k] ?? k,
      key: k,
      my: scores[k] ?? 0,
      community: communityScores[k] ?? 0,
    }));
  }, [order, visible, scores, communityScores]);

  /* ----- saved-just-now label ----- */
  const savedLabel = useMemo(() => {
    if (!reviewSavedAt) return null;
    const diff = (Date.now() - reviewSavedAt.getTime()) / 1000;
    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved ${reviewSavedAt.toLocaleTimeString()}`;
  }, [reviewSavedAt]);

  /* =====================================================================
     Render
     ===================================================================== */

  return (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="mx-2 my-2 rounded-2xl border border-border/60 bg-card/70 shadow-sm p-5 md:p-7">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Song details
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="rounded-full">
              Cancel
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[28fr_32fr_40fr] gap-6 lg:gap-8">
          {/* ----------- Column 1: Meta ----------- */}
          <MetaColumn
            track={track}
            albumCover={albumCover}
            artistName={artistName}
            metadata={metadata}
          />

          {/* ----------- Column 2: Lyrics ----------- */}
          <LyricsColumn
            lyrics={lyrics}
            loading={lyricsLoading}
            autoScroll={autoScroll}
            setAutoScroll={setAutoScroll}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            textSize={textSize}
            setTextSize={setTextSize}
          />

          {/* ----------- Column 3: Deep Criteria ----------- */}
          <div className="md:col-span-2 lg:col-span-1">
            <CriteriaColumn
              radarData={radarData}
              showCommunity={showCommunity}
              setShowCommunity={setShowCommunity}
              gearOpen={gearOpen}
              setGearOpen={setGearOpen}
              visible={visible}
              order={order}
              scores={scores}
              updateScore={updateScore}
              toggleCriterion={toggleCriterion}
              moveCriterion={moveCriterion}
            />
          </div>
        </div>

        {/* ----------- Review ----------- */}
        <div className="mt-8 pt-6 border-t border-border/60">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-2xl font-bold">Review</h3>
            <p className="text-xs text-muted-foreground">Personal notes for this track</p>
          </div>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, REVIEW_MAX))}
            placeholder="Write what hit, what dragged, and what you want to remember about this song."
            rows={4}
            className="resize-none bg-background/60 border-border/60 text-base"
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Max {REVIEW_MAX} characters</span>
            <span>
              {savedLabel ? `${savedLabel} · ` : ''}
              {review.length}/{REVIEW_MAX}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* =========================================================================
   Column 1: Meta
   ========================================================================= */

function MetaColumn({
  track,
  albumCover,
  artistName,
  metadata,
}: {
  track: DeezerTrack;
  albumCover: string | null;
  artistName?: string;
  metadata: Metadata;
}) {
  const [imgError, setImgError] = useState(false);

  const sections: { title: string; rows: MetadataSection[] }[] = [
    { title: 'Composition & Lyrics', rows: metadata.composition ?? [] },
    { title: 'Production & Engineering', rows: metadata.production ?? [] },
    { title: 'Performers', rows: metadata.performers ?? [] },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-3xl font-bold leading-tight">{track.title}</h3>

      <div className="w-full aspect-square max-w-[260px] rounded-xl bg-secondary overflow-hidden border border-border/60 flex items-center justify-center">
        {albumCover && !imgError ? (
          <img
            src={albumCover}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      <Badge variant="secondary" className="rounded-full text-xs">
        {metadata.release_type ?? 'Album'}
      </Badge>

      <div className="space-y-5">
        {sections.map((s) => (
          <CollapsibleCreditSection key={s.title} title={s.title} rows={s.rows} />
        ))}
        {artistName && sections.every((s) => s.rows.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Credits not available yet for this track.
          </p>
        )}
      </div>
    </div>
  );
}

function CollapsibleCreditSection({ title, rows }: { title: string; rows: MetadataSection[] }) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? rows : rows.slice(0, 8);
  return (
    <div>
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">—</p>
      ) : (
        <>
          <ul className="space-y-2">
            {display.map((r, i) => (
              <li key={i} className="text-sm">
                <p className="text-foreground leading-tight">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.role}</p>
              </li>
            ))}
          </ul>
          {rows.length > 8 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {expanded ? 'Show less' : `Show ${rows.length - 8} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================================
   Column 2: Lyrics
   ========================================================================= */

function LyricsColumn({
  lyrics,
  loading,
  autoScroll,
  setAutoScroll,
  focusMode,
  setFocusMode,
  textSize,
  setTextSize,
}: {
  lyrics: { plain?: string; synced?: SyncedLine[] } | null;
  loading: boolean;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  focusMode: boolean;
  setFocusMode: (v: boolean) => void;
  textSize: number;
  setTextSize: (n: number) => void;
}) {
  const hasSynced = !!lyrics?.synced && lyrics.synced.length > 0;
  const hasPlain = !!lyrics?.plain && lyrics.plain.trim().length > 0;
  const lines = hasSynced
    ? lyrics!.synced!
    : hasPlain
    ? lyrics!.plain!.split('\n').map((line) => ({ line }))
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold">Lyrics</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
            Auto-scroll
          </label>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border border-border/60 bg-background/40 p-4 h-[420px] overflow-y-auto',
          focusMode && 'bg-background',
        )}
        style={{ fontSize: textSize }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : lines.length === 0 ? (
          <p className="text-muted-foreground text-center mt-12">Lyrics unavailable</p>
        ) : (
          <div className="space-y-2 leading-relaxed">
            {lines.map((l, i) => (
              <p
                key={i}
                className={cn(
                  'transition-colors',
                  l.line.trim() === ''
                    ? 'h-3'
                    : i === 0
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground',
                )}
              >
                {l.line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <Switch checked={focusMode} onCheckedChange={setFocusMode} />
          Focus mode
        </label>
        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
          <span>A</span>
          <Slider
            value={[textSize]}
            min={12}
            max={22}
            step={1}
            onValueChange={(v) => setTextSize(v[0])}
          />
          <span className="text-base">A</span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Column 3: Criteria
   ========================================================================= */

function CriteriaColumn({
  radarData,
  showCommunity,
  setShowCommunity,
  gearOpen,
  setGearOpen,
  visible,
  order,
  scores,
  updateScore,
  toggleCriterion,
  moveCriterion,
}: {
  radarData: { criterion: string; key: string; my: number; community: number }[];
  showCommunity: boolean;
  setShowCommunity: (v: boolean) => void;
  gearOpen: boolean;
  setGearOpen: (v: boolean) => void;
  visible: string[];
  order: string[];
  scores: Record<string, number>;
  updateScore: (key: string, value: number) => void;
  toggleCriterion: (key: string) => void;
  moveCriterion: (key: string, dir: -1 | 1) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold">Deep Criteria</h3>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary rounded-full px-2.5 py-1">
            Community
            <Switch checked={showCommunity} onCheckedChange={setShowCommunity} />
          </label>
          <button
            onClick={() => setGearOpen(!gearOpen)}
            className={cn(
              'p-2 rounded-lg border border-border/60 transition-colors',
              gearOpen ? 'bg-secondary' : 'hover:bg-secondary',
            )}
            aria-label="Configure criteria"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Radar */}
      <div className="h-[280px] -mx-2">
        {radarData.length >= 3 ? (
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="criterion"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              {showCommunity && (
                <Radar
                  name="Community"
                  dataKey="community"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.15}
                />
              )}
              <Radar
                name="My"
                dataKey="my"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.45}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Pick at least 3 criteria to render the radar.
          </div>
        )}
      </div>

      {/* Gear panel */}
      <AnimatePresence>
        {gearOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Visible criteria · max {MAX_VISIBLE}
              </p>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {Object.entries(CRITERIA_LIBRARY).map(([key, label]) => {
                  const checked = visible.includes(key);
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleCriterion(key)}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>

              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Order
              </p>
              <ul className="space-y-1">
                {order
                  .filter((k) => visible.includes(k))
                  .map((key) => (
                    <li
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 text-xs"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="flex-1">{CRITERIA_LIBRARY[key]}</span>
                      <button
                        onClick={() => moveCriterion(key, -1)}
                        className="text-muted-foreground hover:text-foreground px-1"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveCriterion(key, 1)}
                        className="text-muted-foreground hover:text-foreground px-1"
                      >
                        ↓
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Criteria rating rows */}
      <div className="mt-5 space-y-4">
        {order
          .filter((k) => visible.includes(k))
          .map((key) => {
            const value = scores[key] ?? 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {CRITERIA_LIBRARY[key]}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={value}
                    onChange={(e) => updateScore(key, Number(e.target.value))}
                    className="w-12 text-right bg-transparent text-sm font-mono border-b border-transparent focus:border-border focus:outline-none"
                  />
                </div>
                <Slider
                  value={[value]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => updateScore(key, v[0])}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}
