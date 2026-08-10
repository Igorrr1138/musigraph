import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, X, FadersHorizontal } from '@/components/icons';
import {
  DEFAULT_PIXEL_PARAMS,
  type PixelatedCoverParams,
} from '@/components/music/PixelatedCover';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: PixelatedCoverParams;
  onChange: (next: PixelatedCoverParams) => void;
}

function Row({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-display text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export function PixelatedCoverControls({ open, onOpenChange, params, onChange }: Props) {
  const set = (patch: Partial<PixelatedCoverParams>) => onChange({ ...params, ...patch });

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
        className="absolute right-4 top-4 z-20 gap-2 font-display text-[10px] uppercase tracking-wide"
      >
        <FadersHorizontal className="h-3.5 w-3.5" weight="bold" />
        Pixel FX
      </Button>
    );
  }

  return (
    <div className="absolute right-4 top-4 z-20 w-64 rounded-lg border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-[10px] uppercase tracking-wide text-muted-foreground">
          Pixel animation
        </span>
        <button
          type="button"
          aria-label="Close pixel controls"
          onClick={() => onOpenChange(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" weight="bold" />
        </button>
      </div>

      <div className="space-y-3">
        <Row
          label="Min resolution"
          value={params.minResolution}
          min={2}
          max={Math.max(4, params.maxResolution - 1)}
          suffix="px"
          onChange={(v) => set({ minResolution: v })}
        />
        <Row
          label="Max resolution"
          value={params.maxResolution}
          min={params.minResolution + 1}
          max={120}
          suffix="px"
          onChange={(v) => set({ maxResolution: v })}
        />
        <Row
          label="Duration"
          value={params.duration}
          min={1}
          max={60}
          suffix="s"
          onChange={(v) => set({ duration: v })}
        />
        <Row
          label="Opacity"
          value={Math.round(params.opacity * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => set({ opacity: v / 100 })}
        />
        <Row
          label="Greyscale"
          value={Math.round(params.grayscale * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => set({ grayscale: v / 100 })}
        />
        <Row
          label="Gap"
          value={params.gap}
          min={0}
          max={12}
          suffix="px"
          onChange={(v) => set({ gap: v })}
        />

        <div className="flex items-center justify-between font-display text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Shape</span>
          <div className="flex gap-1">
            {(['square', 'circle'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ shape: s })}
                className={
                  'rounded px-2 py-1 text-[10px] uppercase transition-colors ' +
                  (params.shape === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="flex-1 gap-2 font-display text-[10px] uppercase tracking-wide"
            onClick={() => set({ playing: !params.playing })}
          >
            {params.playing ? (
              <Pause className="h-3.5 w-3.5" weight="fill" />
            ) : (
              <Play className="h-3.5 w-3.5" weight="fill" />
            )}
            {params.playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Reset pixel animation"
            onClick={() => onChange({ ...DEFAULT_PIXEL_PARAMS })}
          >
            <RotateCcw className="h-3.5 w-3.5" weight="bold" />
          </Button>
        </div>
      </div>
    </div>
  );
}
