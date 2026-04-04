import { useId, type HTMLAttributes, type ReactNode } from 'react';

import type { ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export const chartPalette = {
  primary: 'hsl(var(--primary))',
  primarySoft: 'hsl(var(--primary) / 0.18)',
  gradientStart: 'hsl(var(--gradient-start))',
  gradientEnd: 'hsl(var(--gradient-end))',
  accent: 'hsl(var(--accent))',
  accentSoft: 'hsl(var(--accent) / 0.16)',
  grid: 'hsl(var(--border) / 0.72)',
  axis: 'hsl(var(--muted-foreground))',
  axisSoft: 'hsl(var(--muted-foreground) / 0.18)',
  surfaceLine: 'hsl(var(--foreground) / 0.08)',
} as const;

export const ratingChartConfig = {
  yourRating: {
    label: 'Your Rating',
    color: chartPalette.primary,
  },
  communityRating: {
    label: 'Community Avg',
    color: chartPalette.accent,
  },
  rating: {
    label: 'Rating',
    color: chartPalette.primary,
  },
  average: {
    label: 'Average',
    color: chartPalette.gradientEnd,
  },
} satisfies ChartConfig;

interface ChartPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ChartPanel({ className, children, ...props }: ChartPanelProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] border border-border/60 bg-card/70 p-6 shadow-[0_32px_90px_-48px_hsl(var(--background))]',
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-12 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/5" />
      <div className="relative">{children}</div>
    </div>
  );
}

interface TooltipShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function TooltipShell({ className, children, ...props }: TooltipShellProps) {
  return (
    <div
      className={cn(
        'min-w-[220px] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-[0_28px_70px_-36px_hsl(var(--background))] backdrop-blur-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface LegendPillItem {
  label: string;
  color: string;
  helper?: string;
  dashed?: boolean;
}

export function LegendPills({
  items,
  className,
}: {
  items: LegendPillItem[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 pt-5', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span
            className={cn(
              'block h-2.5 w-7 rounded-full',
              item.dashed && 'border border-dashed bg-transparent',
            )}
            style={
              item.dashed
                ? { borderColor: item.color }
                : {
                    background: `linear-gradient(90deg, ${item.color}, ${item.color}99)`,
                    boxShadow: `0 0 18px -8px ${item.color}`,
                  }
            }
          />
          <span className="font-medium text-foreground">{item.label}</span>
          {item.helper ? <span className="text-muted-foreground/80">{item.helper}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function getBrandRatingColor(rating: number) {
  if (rating >= 8.5) return chartPalette.gradientStart;
  if (rating >= 7) return chartPalette.primary;
  if (rating >= 5) return chartPalette.gradientEnd;
  return chartPalette.accent;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

interface RatingSparklineProps {
  values: number[];
  className?: string;
  width?: number;
  height?: number;
}

export function RatingSparkline({
  values,
  className,
  width = 240,
  height = 48,
}: RatingSparklineProps) {
  const id = useId().replace(/:/g, '');

  if (!values.length) {
    return null;
  }

  const padX = 4;
  const padY = 4;
  const graphWidth = width - padX * 2;
  const graphHeight = height - padY * 2;
  const baseline = height - padY;
  const denominator = Math.max(values.length - 1, 1);

  const points = values.map((value, index) => ({
    x: padX + (graphWidth * index) / denominator,
    y: padY + graphHeight - (value / 10) * graphHeight,
  }));

  const linePath = buildLinePath(points);
  const areaPath =
    values.length === 1
      ? ''
      : `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('h-11 w-full overflow-visible', className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={chartPalette.gradientStart} />
          <stop offset="50%" stopColor={chartPalette.primary} />
          <stop offset="100%" stopColor={chartPalette.gradientEnd} />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={chartPalette.primary} stopOpacity="0.2" />
          <stop offset="70%" stopColor={chartPalette.primary} stopOpacity="0.05" />
          <stop offset="100%" stopColor={chartPalette.primary} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={`M ${padX} ${baseline} H ${width - padX}`}
        fill="none"
        stroke={chartPalette.surfaceLine}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      {areaPath ? <path d={areaPath} fill={`url(#${id}-fill)`} /> : null}

      {values.length === 1 ? (
        <circle
          cx={points[0].x}
          cy={points[0].y}
          r="3.5"
          fill={chartPalette.primary}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {points.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}`}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 3 : 1.75}
          fill={index === points.length - 1 ? chartPalette.gradientEnd : chartPalette.primary}
          stroke="hsl(var(--background))"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
