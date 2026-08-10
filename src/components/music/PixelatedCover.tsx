import { useEffect, useRef, useState } from 'react';

/**
 * Close Pixelate (desandro) style renderer, ported to canvas + rAF.
 * Draws the album cover as animated square pixels, greyscaled, low opacity.
 */
interface PixelatedCoverProps {
  src: string;
  className?: string;
  /** Pixel block size range animated back and forth */
  minResolution?: number;
  maxResolution?: number;
  /** Seconds for one direction of the loop */
  duration?: number;
}

export function PixelatedCover({
  src,
  className,
  minResolution = 8,
  maxResolution = 42,
  duration = 14,
}: PixelatedCoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

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

      const start = performance.now();

      const render = (now: number) => {
        // ping-pong easing between min and max resolution
        const t = ((now - start) / 1000) % (duration * 2);
        const p = t < duration ? t / duration : 2 - t / duration;
        const eased = 0.5 - Math.cos(p * Math.PI) / 2;
        const res = Math.max(2, Math.round(minResolution + (maxResolution - minResolution) * eased));
        const offset = res / 2;

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
            ctx.fillStyle = `rgba(${grey},${grey},${grey},${a})`;
            ctx.fillRect(x - offset, y - offset, res, res);
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
  }, [src, minResolution, maxResolution, duration]);

  if (failed) return null;

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
