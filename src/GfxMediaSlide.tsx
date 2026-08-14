import { useEffect, useRef, useCallback } from 'react';
import { resolveImageSrc, resolveVideoPlaybackSrc, isVideoMediaUrl } from './mediaUrl';

type GfxMediaSlideProps = {
  url: string;
  alt?: string;
  isVideo?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  objectFit?: 'contain' | 'cover';
};

export function GfxMediaSlide({
  url,
  alt = '',
  isVideo,
  style,
  className,
  onClick,
  objectFit = 'contain',
}: GfxMediaSlideProps) {
  const video = isVideo || isVideoMediaUrl(url);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const tryPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.playsInline = true;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  useEffect(() => {
    if (!video) return;
    tryPlay();
    const el = videoRef.current;
    if (!el) return;

    const onVis = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    document.addEventListener('visibilitychange', onVis);

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (entries.some(e => e.isIntersecting)) tryPlay();
        }, { threshold: 0.2 })
      : null;
    if (io && containerRef.current) io.observe(containerRef.current);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
    };
  }, [url, video, tryPlay]);

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    display: 'block',
    ...style,
  };

  if (video) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} onClick={onClick}>
        <video
          ref={videoRef}
          src={resolveVideoPlaybackSrc(url)}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          className={className}
          style={baseStyle}
          onLoadedData={tryPlay}
          onCanPlay={tryPlay}
          onTouchStart={tryPlay}
        />
      </div>
    );
  }

  return (
    <img
      src={resolveImageSrc(url)}
      alt={alt}
      className={className}
      style={baseStyle}
      onClick={onClick}
    />
  );
}
