import { isGoogleDriveUrl, resolveImageSrc } from './mediaUrl';
import {
  getDefaultSkillIconForName,
  isReliableCustomSkillIcon,
  normalizeSkillIconField,
} from './skillIconDefaults';

/** True when icon should render as <img> (URL / data-URI), not Font Awesome class. */
export function isSkillImageIcon(icon: string): boolean {
  if (!icon) return false;
  const v = icon.trim();
  if (v.startsWith('data:')) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../')) return true;
  if (/^uploads\//i.test(v)) return true;
  if (/\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(v)) return true;
  if (/drive\.google\.com|docs\.google\.com/i.test(v)) return true;
  return false;
}

/** رابط عرض الأيقونة — يدعم Google Drive والرفع المحلي */
export function resolveSkillIconSrc(icon: string, size = 64, skillName = ''): string {
  const normalized = normalizeSkillIconField((icon || '').trim());
  if (!normalized) {
    return getDefaultSkillIconForName(skillName) || '';
  }
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return normalized;
  if (normalized.startsWith('uploads/')) return `/${normalized.replace(/^\/+/, '')}`;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const path = new URL(normalized).pathname
        .replace(/\/uploads\/skill\//gi, '/uploads/skills/');
      if (path.startsWith('/uploads/')) return path;
    } catch { /* ignore */ }
  }
  if (!isSkillImageIcon(normalized)) return '';
  return resolveImageSrc(normalized, Math.max(64, size * 4));
}

/**
 * مصدر العرض المفضّل: أيقونة لوحة التحكم أولاً،
 * ثم الافتراضية حسب اسم البرنامج عند غياب رفع مخصص.
 */
export function getPreferredSkillIconSrc(icon: string, size = 64, skillName = ''): string {
  const custom = (icon || '').trim();
  if (custom && (isReliableCustomSkillIcon(custom) || isSkillImageIcon(custom))) {
    const resolved = resolveSkillIconSrc(custom, size, skillName);
    if (resolved) return resolved;
  }
  const def = getDefaultSkillIconForName(skillName);
  if (def) return def;
  return resolveSkillIconSrc(custom, size, skillName);
}

function imgProxyFallback(src: string): string {
  const base = typeof window !== 'undefined' && window.location.pathname.includes('/api/')
    ? '../api/img-proxy.php'
    : '/api/img-proxy.php';
  return `${base}?url=${encodeURIComponent(src)}`;
}

/** Renders a skill icon: <img> if it's a URL/data-URI, otherwise a Font Awesome <i> */
export function SkillIcon({
  icon,
  name = '',
  size = 18,
  className = '',
}: {
  icon: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const defaultIcon = getDefaultSkillIconForName(name);
  const resolved = getPreferredSkillIconSrc(icon, size, name);
  const src = resolved || defaultIcon;

  if (src || isSkillImageIcon(icon)) {
    if (!src) return null;
    return (
      <img
        className={`cv-skill-icon ${className}`.trim()}
        src={src}
        alt=""
        data-raw-icon={icon || defaultIcon}
        data-skill-name={name}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const img = e.currentTarget;
          const raw = img.dataset.rawIcon || icon;
          const step = Number(img.dataset.fallbackStep || '0');
          const skillName = img.dataset.skillName || name;
          const def = getDefaultSkillIconForName(skillName);

          if (step >= 3) {
            img.style.visibility = 'hidden';
            return;
          }

          if (step === 0 && def && !img.src.includes('simpleicons.org')) {
            img.dataset.fallbackStep = '1';
            img.src = def;
            return;
          }

          if (step <= 1 && /^https?:\/\//i.test(raw)) {
            try {
              const path = new URL(raw).pathname
                .replace(/\/uploads\/skill\//gi, '/uploads/skills/');
              if (path.startsWith('/uploads/') && /\.(svg|png|jpe?g|webp|gif|ico)(\?|$)/i.test(path)) {
                img.dataset.fallbackStep = '2';
                img.src = path;
                return;
              }
            } catch { /* ignore */ }
          }

          if (step < 3 && (isGoogleDriveUrl(raw) || /^https?:\/\//i.test(raw))) {
            img.dataset.fallbackStep = '3';
            img.src = imgProxyFallback(resolveSkillIconSrc(raw, size, skillName) || raw);
            return;
          }

          img.style.visibility = 'hidden';
        }}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          maxWidth: size,
          maxHeight: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      />
    );
  }

  const raw = (icon || '').trim();
  const isBrand = raw.includes('fa-brands') || /^fab\b/i.test(raw);
  const family = isBrand ? 'fa-brands' : 'fa-solid';
  let cls = raw;
  if (!cls.startsWith('fa-')) cls = `fa-${cls || 'star'}`;
  if (isBrand && !cls.includes('fa-brands')) {
    cls = cls.replace(/^fab\s+/, '').replace(/^fa-/, 'fa-');
  }
  return <i className={`cv-skill-icon ${family} ${cls} ${className}`.trim()} style={{ fontSize: size * 0.8 }} />;
}
