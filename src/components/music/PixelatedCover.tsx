import { useEffect, useRef, useState } from 'react';

/**
 * Close Pixelate (desandro) style renderer, ported to canvas + rAF.
 * Draws the album cover as animated square pixels, greyscaled, low opacity.
 */
export interface PixelatedCoverParams {
  /** Pixel block size range animated back and forth */
  minResolution: number;
  maxResolution: number;
  /** Seconds for one direction of the loop */
  duration: number;
  /** 0..1 canvas opacity */
  opacity: number;
  /** 0..1 greyscale amount */
  grayscale: number;
  /** Square or circle pixels */
  shape: 'square' | 'circle';
  /** Gap between pixels in px */
  gap: number;
  /** Animation running */
  playing: boolean;
}

export const DEFAULT_PIXEL_PARAMS: PixelatedCoverParams = {
  minResolution: 8,
  maxResolution: 42,
  duration: 14,
  opacity: 0.2,
  grayscale: 1,
  shape: 'square',
  gap: 0,
  playing: true,
};

interface PixelatedCoverProps extends Partial<PixelatedCoverParams> {
  src: string;
  className?: string;
}

export function PixelatedCover({ src, className, ...overrides }: PixelatedCoverProps) {
  const p = { ...DEFAULT_PIXEL_PARAMS, ...overrides };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  // keep latest params without restarting the image load
  const paramsRef = useRef(p);
  paramsRef.current = p;

  useEffect(() => {
    if (!src) return;
    let raf = 0;
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onerror = () => setFailed(true);
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;

      // Offscreen source for sampling
      const source = document.createElement('canvas');
      source.width = w;
      source.height = h;
      const sctx = source.getContext('2d');
      const ctx = canvas.getContext('2d');
      if (!sctx || !ctx) return;
      sctx.drawImage(img, 0, 0);

      let data: Uint8ClampedArray;
      try {
        data = sctx.getImageData(0, 0, w, h).data;
      } catch {
        setFailed(true);
        return;
      }

      let elapsed = 0;
      let last = performance.now();

      const render = (now: number) => {
        const {
          minResolution,
          maxResolution,
          duration,
          grayscale,
          shape,
          gap,
          playing,
        } = paramsRef.current;

        const dt = (now - last) / 1000;
        last = now;
        if (playing) elapsed += dt;

        const dur = Math.max(0.5, duration);
        const t = elapsed % (dur * 2);
        const prog = t < dur ? t / dur : 2 - t / dur;
        const eased = 0.5 - Math.cos(prog * Math.PI) / 2;
        const res = Math.max(
          2,
          Math.round(minResolution + (maxResolution - minResolution) * eased),
        );
        const offset = res / 2;
        const size = Math.max(1, res - gap);

        ctx.clearRect(0, 0, w, h);
        for (let y = 0; y < h + res; y += res) {
          for (let x = 0; x < w + res; x += res) {
            const pixelX = Math.min(w - 1, Math.max(0, Math.round(x + offset)));
            const pixelY = Math.min(h - 1, Math.max(0, Math.round(y + offset)));
            const i = (pixelY * w + pixelX) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3] / 255;
            if (!a) continue;
            const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            const cr = Math.round(r + (grey - r) * grayscale);
            const cg = Math.round(g + (grey - g) * grayscale);
            const cb = Math.round(b + (grey - b) * grayscale);
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
            if (shape === 'circle') {
              ctx.beginPath();
              ctx.arc(x, y, size / 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(x - offset, y - offset, size, size);
            }
          }
        }
        raf = requestAnimationFrame(render);
      };

      raf = requestAnimationFrame(render);
    };

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ opacity: p.opacity }}
    />
  );
}
