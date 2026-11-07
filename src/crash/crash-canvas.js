import { CHECKPOINTS, MATCH_MINUTES } from './crash-engine';

const PADDING = { top: 18, right: 20, bottom: 22, left: 10 };
const GRAVITY = 520;
const MULTIPLIER_GUIDES = [0.5, 2, 3, 5, 10, 20, 50];

const COLOR_VARIABLES = {
  primary: '--primary-base',
  promo: '--promo-base',
  success: '--success-base',
  error: '--error-base',
  warn: '--warn-base',
  accent: '--accent-base',
  text: '--color-base',
  hint: '--color-hint',
  line: '--border-base',
  stripe: '--bg-extra',
};

export function readCanvasColors(element) {
  const styles = getComputedStyle(element);

  return Object.fromEntries(
    Object.entries(COLOR_VARIABLES).map(([key, variable]) => [key, styles.getPropertyValue(variable).trim()])
  );
}

const randomBetween = (min, max) => min + Math.random() * (max - min);

export function createParticleBurst({
  x,
  y,
  colors,
  count,
  speed,
  spread = Math.PI * 2,
  angle = 0,
  life,
  size,
  shape,
}) {
  return Array.from({ length: count }, () => {
    const direction = angle + randomBetween(-spread / 2, spread / 2);
    const velocity = randomBetween(speed * 0.35, speed);

    return {
      x,
      y,
      vx: Math.cos(direction) * velocity,
      vy: Math.sin(direction) * velocity,
      life: randomBetween(life * 0.6, life),
      age: 0,
      size: randomBetween(size * 0.5, size),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-8, 8),
      shape,
    };
  });
}

export function updateParticles(particles, deltaSeconds) {
  return particles.filter(particle => {
    particle.age += deltaSeconds;
    particle.vy += (particle.shape === 'spark' ? GRAVITY * 0.15 : GRAVITY) * deltaSeconds;
    particle.vx *= 0.985;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.rotation += particle.spin * deltaSeconds;

    return particle.age < particle.life;
  });
}

function drawParticles(context, particles) {
  particles.forEach(particle => {
    context.save();
    context.globalAlpha = Math.max(0, 1 - particle.age / particle.life);
    context.fillStyle = particle.color;
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);

    if (particle.shape === 'confetti') {
      context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
    } else {
      context.shadowBlur = particle.shape === 'coin' ? 10 : 6;
      context.shadowColor = particle.color;
      context.beginPath();
      context.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  });
}

export function createGeometry(width, height, maxY) {
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  return {
    width,
    height,
    toX: minute => PADDING.left + (minute / MATCH_MINUTES) * plotWidth,
    toY: multiplier => PADDING.top + plotHeight - (Math.max(multiplier, 0) / maxY) * plotHeight,
    bottom: PADDING.top + plotHeight,
    top: PADDING.top,
    maxY,
  };
}

function drawPitch(context, geometry, colors) {
  const stripeCount = 6;
  const stripeWidth = (geometry.toX(MATCH_MINUTES) - geometry.toX(0)) / stripeCount;

  context.save();
  context.fillStyle = colors.stripe;
  context.globalAlpha = 0.12;

  for (let index = 0; index < stripeCount; index += 2) {
    context.fillRect(geometry.toX(0) + index * stripeWidth, geometry.top, stripeWidth, geometry.bottom - geometry.top);
  }

  context.globalAlpha = 0.5;
  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(geometry.toX(MATCH_MINUTES / 2), geometry.top);
  context.lineTo(geometry.toX(MATCH_MINUTES / 2), geometry.bottom);
  context.stroke();
  context.setLineDash([]);
  context.beginPath();
  context.arc(
    geometry.toX(MATCH_MINUTES / 2),
    (geometry.top + geometry.bottom) / 2,
    (geometry.bottom - geometry.top) / 5,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.restore();
}

const LABEL_GAP = 14;

function drawReferenceLine(context, geometry, { value, color, label, alpha, dashed, isLabelBelow = false }) {
  if (value > geometry.maxY) return;

  const y = geometry.toY(value);

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1;
  if (dashed) context.setLineDash([6, 4]);
  context.beginPath();
  context.moveTo(geometry.toX(0), y);
  context.lineTo(geometry.toX(MATCH_MINUTES), y);
  context.stroke();
  context.font = '700 10px sans-serif';
  context.textAlign = 'right';
  context.fillText(label, geometry.toX(MATCH_MINUTES), isLabelBelow ? y + 12 : y - 5);
  context.restore();
}

function drawAxes(context, geometry, colors, { passedCheckpoints, maxMultiplier }) {
  context.save();
  context.font = '600 10px sans-serif';
  context.textBaseline = 'middle';

  MULTIPLIER_GUIDES.filter(value => value < geometry.maxY && Math.abs(value - (maxMultiplier ?? 0)) > 0.3).forEach(
    value => {
      const y = geometry.toY(value);

      context.globalAlpha = 0.2;
      context.strokeStyle = colors.line;
      context.beginPath();
      context.moveTo(geometry.toX(0), y);
      context.lineTo(geometry.toX(MATCH_MINUTES), y);
      context.stroke();
      context.globalAlpha = 0.6;
      context.fillStyle = colors.hint;
      context.fillText(`${value}x`, geometry.toX(0) + 4, y - 7);
    }
  );

  context.textAlign = 'center';
  CHECKPOINTS.forEach(minute => {
    const isPassed = passedCheckpoints.includes(minute);

    context.globalAlpha = isPassed ? 1 : 0.6;
    context.fillStyle = isPassed ? colors.success : colors.hint;
    context.fillText(minute === MATCH_MINUTES ? 'FT' : `${minute}'`, geometry.toX(minute), geometry.bottom + 12);
  });

  context.restore();

  const isOddsClose = Boolean(maxMultiplier) && Math.abs(geometry.toY(maxMultiplier) - geometry.toY(1)) < LABEL_GAP;

  drawReferenceLine(context, geometry, {
    value: 1,
    color: colors.hint,
    label: 'stake 1.00x',
    alpha: 0.7,
    dashed: false,
    isLabelBelow: isOddsClose,
  });

  if (maxMultiplier) {
    drawReferenceLine(context, geometry, {
      value: maxMultiplier,
      color: colors.promo,
      label: `odds ${maxMultiplier.toFixed(2)}x`,
      alpha: 0.9,
      dashed: true,
    });
  }
}

function strokePath(context, geometry, points, { color, gradientTo, width, glow, alpha = 1, dashed = false }) {
  if (points.length < 2) return;

  context.save();
  context.globalAlpha = alpha;
  context.lineWidth = width;
  context.lineJoin = 'round';
  context.lineCap = 'round';

  if (gradientTo) {
    const gradient = context.createLinearGradient(geometry.toX(0), 0, geometry.toX(MATCH_MINUTES), 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, gradientTo);
    context.strokeStyle = gradient;
  } else {
    context.strokeStyle = color;
  }

  if (glow) {
    context.shadowBlur = glow;
    context.shadowColor = color;
  }

  if (dashed) context.setLineDash([6, 6]);

  context.beginPath();
  points.forEach(({ minute, multiplier }, index) => {
    if (index === 0) context.moveTo(geometry.toX(minute), geometry.toY(multiplier));
    else context.lineTo(geometry.toX(minute), geometry.toY(multiplier));
  });
  context.stroke();
  context.restore();
}

function fillUnderPath(context, geometry, points, color) {
  if (points.length < 2) return;

  const gradient = context.createLinearGradient(0, geometry.top, 0, geometry.bottom);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');

  context.save();
  context.globalAlpha = 0.25;
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(geometry.toX(points[0].minute), geometry.bottom);
  points.forEach(({ minute, multiplier }) => context.lineTo(geometry.toX(minute), geometry.toY(multiplier)));
  context.lineTo(geometry.toX(points[points.length - 1].minute), geometry.bottom);
  context.closePath();
  context.fill();
  context.restore();
}

function drawGlyph(context, { x, y, rotation, glyph, size = 22 }) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.font = `${size}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(glyph, 0, 1);
  context.restore();
}

function drawCashOutMarker(context, geometry, colors, cashOut) {
  const x = geometry.toX(cashOut.minute);
  const y = geometry.toY(cashOut.multiplier);

  context.save();
  context.fillStyle = colors.success;
  context.shadowBlur = 12;
  context.shadowColor = colors.success;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.font = '700 11px sans-serif';
  const labelY = y - 14 < geometry.top ? y + 18 : y - 14;
  context.textAlign = x > geometry.width - 30 ? 'right' : 'center';
  context.fillText(`${cashOut.multiplier.toFixed(2)}x`, x, labelY);
  context.restore();
}

function splitHistory(history, cashOut) {
  if (!cashOut) return { active: history, ghost: [] };

  const cutIndex = history.findIndex(point => point.minute >= cashOut.minute);
  const index = cutIndex === -1 ? history.length - 1 : cutIndex;

  return { active: history.slice(0, index + 1), ghost: history.slice(index) };
}

export function drawFrame(context, { geometry, colors, view, history, particles, time }) {
  const { isIdle, isCrashed, isSuspense, cashOut, passedCheckpoints, maxMultiplier, theme } = view;

  context.clearRect(0, 0, geometry.width, geometry.height);
  drawPitch(context, geometry, colors);
  drawAxes(context, geometry, colors, { passedCheckpoints, maxMultiplier });

  if (isIdle || history.length === 0) {
    drawGlyph(context, {
      x: geometry.toX(0) + 14,
      y: geometry.toY(1) - 14 + Math.sin(time * 3) * 4,
      rotation: Math.sin(time) * 0.3,
      glyph: theme.glyph,
    });
    drawParticles(context, particles);
    return;
  }

  const lineColor = isCrashed ? colors.error : colors[theme.lineColor];
  const gradientTo = isCrashed ? colors.error : colors[theme.gradientColor];
  const { active, ghost } = splitHistory(history, cashOut);
  const head = history[history.length - 1];

  fillUnderPath(context, geometry, active, cashOut ? colors.success : lineColor);
  strokePath(context, geometry, active, {
    color: cashOut ? colors.success : lineColor,
    gradientTo: cashOut ? null : gradientTo,
    width: 3.5,
    glow: isSuspense ? 22 + Math.sin(time * 18) * 8 : 16,
  });
  strokePath(context, geometry, ghost, {
    color: isCrashed ? colors.error : colors.hint,
    width: 2,
    alpha: 0.6,
    dashed: true,
  });

  if (cashOut) drawCashOutMarker(context, geometry, colors, cashOut);

  drawParticles(context, particles);
  drawGlyph(context, {
    x: geometry.toX(head.minute),
    y: geometry.toY(head.multiplier),
    rotation: isSuspense && !isCrashed ? Math.sin(time * 40) * 0.25 : 0,
    glyph: isCrashed ? '💥' : theme.glyph,
    size: isSuspense ? 28 : 22,
  });
}

export const getHeadPosition = (geometry, history) => {
  const head = history[history.length - 1] ?? { minute: 0, multiplier: 1 };

  return { x: geometry.toX(head.minute), y: geometry.toY(head.multiplier) };
};
