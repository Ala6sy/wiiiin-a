import { useId, useLayoutEffect, useRef } from 'react';
import {
  applySweepBandProgress,
  buildSvgLightSweepMarkup,
  forceSvgGradientRepaint,
  sanitizeGradId,
} from './logoUtils';

export type ShimmerDirection = 'rtl' | 'ltr';

interface SvgLogoSweepProps {
  logo: string;
  baseColor: string;
  lightColor: string;
  speed: number;
  angle: number;
  motion: boolean;
  direction?: ShimmerDirection;
  bandWidth?: number;
  name: string;
}

function isGradEl(el: Element | null): el is SVGLinearGradientElement {
  return !!el && el.localName?.toLowerCase() === 'lineargradient';
}

function findSweepGradient(host: HTMLElement, gradEsc: string): SVGLinearGradientElement | null {
  const svg = host.querySelector('svg');
  if (!svg) return null;

  const byId = svg.getElementById(gradEsc) ?? host.ownerDocument.getElementById(gradEsc);
  if (isGradEl(byId)) return byId;

  const ns = svg.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'linearGradient');
  if (ns.length > 0) return ns[0] as SVGLinearGradientElement;

  const any = svg.querySelector('linearGradient');
  return isGradEl(any) ? any : null;
}

function mapProgress(t: number, direction: ShimmerDirection): number {
  return direction === 'ltr' ? 1 - t : t;
}

function startAnim(
  grad: SVGLinearGradientElement,
  motion: boolean,
  speed: number,
  direction: ShimmerDirection,
  bandWidth: number,
): (() => void) | undefined {
  const svg = grad.ownerSVGElement;

  if (!motion) {
    applySweepBandProgress(grad, 0.5, bandWidth);
    forceSvgGradientRepaint(svg);
    return undefined;
  }

  const durationMs = Math.max(500, speed * 1000);
  let raf = 0;
  let startMs = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    if (!startMs) startMs = now;
    const t = ((now - startMs) % durationMs) / durationMs;
    applySweepBandProgress(grad, mapProgress(t, direction), bandWidth);
    forceSvgGradientRepaint(svg);
    raf = requestAnimationFrame(tick);
  };

  applySweepBandProgress(grad, mapProgress(0, direction), bandWidth);
  forceSvgGradientRepaint(svg);
  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

export function SvgLogoSweep({
  logo,
  baseColor,
  lightColor,
  speed,
  angle,
  motion,
  direction = 'rtl',
  bandWidth = 0.08,
  name,
}: SvgLogoSweepProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const gradUid = useId().replace(/:/g, '');
  const gradId = `ccSweep${gradUid}`;
  const dir: ShimmerDirection = direction === 'ltr' ? 'ltr' : 'rtl';
  const width = Math.min(0.22, Math.max(0.03, bandWidth));

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const markup = buildSvgLightSweepMarkup(
      logo,
      baseColor,
      lightColor,
      speed,
      angle,
      false,
      gradId,
    );
    if (!markup) {
      host.innerHTML = '';
      return;
    }

    host.innerHTML = markup;

    const gradEsc = sanitizeGradId(gradId);
    let cleanup: (() => void) | undefined;
    let pending = 0;

    const attach = () => {
      const g = findSweepGradient(host, gradEsc);
      if (!g) return;
      cleanup = startAnim(g, motion, speed, dir, width);
    };

    const g0 = findSweepGradient(host, gradEsc);
    if (g0) {
      cleanup = startAnim(g0, motion, speed, dir, width);
    } else {
      pending = requestAnimationFrame(attach);
    }

    return () => {
      cancelAnimationFrame(pending);
      cleanup?.();
    };
  }, [logo, baseColor, lightColor, speed, angle, motion, dir, width, gradId]);

  return (
    <span
      ref={hostRef}
      className="hero-name-logo-svg"
      role="img"
      aria-label={name}
    />
  );
}
