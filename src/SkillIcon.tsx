/** Renders a skill icon: <img> if it's a URL/data-URI, otherwise a Font Awesome <i> */
export function SkillIcon({ icon, size = 18, className = '' }: { icon: string; size?: number; className?: string }) {
  if (icon && (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/'))) {
    return (
      <img
        src={icon} alt=""
        style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      />
    );
  }
  return <i className={`fa-solid ${icon || 'fa-star'} ${className}`} style={{ fontSize: size * 0.8 }} />;
}
