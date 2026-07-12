import { useMemo } from 'react';
import { NameDisplayMode } from './appData';
import { SvgLogoSweep } from './SvgLogoSweep';
import {
  applyLogoColor,
  buildLogoMaskDataUrl,
  buildSweepBeamGradient,
  buildSweepGlow,
  cssMaskUrl,
  isSvgSource,
} from './logoUtils';

interface HeroNameDisplayProps {
  name: string;
  display?: NameDisplayMode;
  logo?: string;
  logoColor?: string;
  shimmer?: boolean;
  shimmerSpeed?: number;
  shimmerColor?: string;
  shimmerAngle?: number;
  shimmerMotion?: boolean;
  shimmerDirection?: 'rtl' | 'ltr';
  shimmerWidth?: number;
  className?: string;
  as?: 'h1' | 'span' | 'div';
}

const DEFAULT_LOGO_COLOR = '#ffffff';
const DEFAULT_SWEEP_COLOR = '#00ccff';
const DEFAULT_SWEEP_SPEED = 3.2;
const DEFAULT_SWEEP_ANGLE = 90;
const DEFAULT_SWEEP_WIDTH = 0.08;

function normalizeSpeed(speed?: number): number {
  if (typeof speed !== 'number' || Number.isNaN(speed)) return DEFAULT_SWEEP_SPEED;
  return Math.min(25, Math.max(0.5, speed));
}

function normalizeAngle(angle?: number): number {
  if (typeof angle !== 'number' || Number.isNaN(angle)) return DEFAULT_SWEEP_ANGLE;
  return Math.min(360, Math.max(0, Math.round(angle)));
}

function normalizeWidth(width?: number): number {
  if (typeof width !== 'number' || Number.isNaN(width)) return DEFAULT_SWEEP_WIDTH;
  return Math.min(0.22, Math.max(0.03, width));
}

export function HeroNameDisplay({
  name,
  display = 'text',
  logo = '',
  logoColor = DEFAULT_LOGO_COLOR,
  shimmer = true,
  shimmerSpeed = DEFAULT_SWEEP_SPEED,
  shimmerColor = DEFAULT_SWEEP_COLOR,
  shimmerAngle = DEFAULT_SWEEP_ANGLE,
  shimmerMotion = true,
  shimmerDirection = 'rtl',
  shimmerWidth = DEFAULT_SWEEP_WIDTH,
  className = 'hero-name',
  as = 'h1',
}: HeroNameDisplayProps) {
  const Tag = as;
  const shimmerOn = shimmer !== false;
  const motionOn = shimmerMotion !== false;
  const speed = normalizeSpeed(shimmerSpeed);
  const angle = normalizeAngle(shimmerAngle);
  const bandWidth = normalizeWidth(shimmerWidth);
  const sweepDir = shimmerDirection === 'ltr' ? 'ltr' : 'rtl';
  const baseColor = logoColor?.trim() || DEFAULT_LOGO_COLOR;
  const lightColor = shimmerColor?.trim() || DEFAULT_SWEEP_COLOR;
  const svgLogo = isSvgSource(logo);

  const sweepVars = {
    '--sweep-speed': `${speed}s`,
    '--sweep-angle': `${angle}deg`,
  } as React.CSSProperties;

  const displaySrc = useMemo(
    () => (logo ? applyLogoColor(logo, baseColor) : ''),
    [logo, baseColor],
  );

  const maskSrc = useMemo(
    () => (logo && !svgLogo ? buildLogoMaskDataUrl(logo) : ''),
    [logo, svgLogo],
  );

  const sweepWrapStyle = useMemo((): React.CSSProperties => ({
    WebkitMaskImage: cssMaskUrl(maskSrc),
    maskImage: cssMaskUrl(maskSrc),
    ...sweepVars,
  }), [maskSrc, speed, angle]);

  const sweepBeamStyle = useMemo((): React.CSSProperties => ({
    background: buildSweepBeamGradient(lightColor),
    filter: buildSweepGlow(lightColor),
  }), [lightColor]);

  const mode =
    display === 'logo' && logo ? 'logo'
    : display === 'handwriting' ? 'handwriting'
    : 'text';

  if (mode === 'logo' && (displaySrc || (shimmerOn && svgLogo))) {
    const useSvgSweep = shimmerOn && svgLogo;
    const usePngSweep = shimmerOn && !svgLogo && maskSrc;

    return (
      <Tag
        className={`${className} hero-name--logo${shimmerOn ? ' hero-name--shimmer' : ''}`}
        style={usePngSweep ? sweepVars : undefined}
      >
        <span className="hero-name-logo-wrap">
          <span className="hero-name-logo-inner">
            {useSvgSweep ? (
              <SvgLogoSweep
                logo={logo}
                baseColor={baseColor}
                lightColor={lightColor}
                speed={speed}
                angle={angle}
                motion={motionOn}
                direction={sweepDir}
                bandWidth={bandWidth}
                name={name}
              />
            ) : (
              <img
                src={displaySrc}
                alt={name}
                className="hero-name-logo-img"
                draggable={false}
              />
            )}
            {usePngSweep && (
              <span
                className={`hero-name-cc-sweep-wrap${motionOn ? '' : ' hero-name-cc-sweep-wrap--static'}`}
                style={sweepWrapStyle}
                aria-hidden="true"
              >
                <span className="hero-name-cc-sweep-track">
                  <span className="hero-name-cc-sweep-beam" style={sweepBeamStyle} />
                </span>
              </span>
            )}
          </span>
        </span>
      </Tag>
    );
  }

  const modeClass = mode === 'handwriting' ? ' hero-name--handwriting' : '';
  return (
    <Tag
      className={`${className}${modeClass}${shimmerOn && motionOn ? ' hero-name--shimmer' : ''}`}
      style={shimmerOn && motionOn ? sweepVars : undefined}
    >
      {name}
    </Tag>
  );
}
