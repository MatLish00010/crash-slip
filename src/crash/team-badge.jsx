import { memo } from 'react';

const DEFAULT_COLORS = ['#3b4252', '#596173'];

const getInitials = name =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');

function TeamBadgeUI({ name, colors = DEFAULT_COLORS, size = 34 }) {
  const [primary, secondary] = colors;

  return (
    <span
      className="sb-TeamBadge"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`,
      }}>
      {getInitials(name)}
    </span>
  );
}

export const TeamBadge = memo(TeamBadgeUI);
