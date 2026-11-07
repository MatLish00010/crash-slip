import clsx from 'clsx';
import { memo, useEffect, useRef, useState } from 'react';

import {
  createGeometry,
  createParticleBurst,
  drawFrame,
  getHeadPosition,
  readCanvasColors,
  updateParticles,
} from './crash-canvas';
import { CHECKPOINTS, getMatchClockMinute, HOT_MINUTE, ROUND_PHASES } from './crash-engine';
import { getMissText, getSuspenseText, THEMES } from './crash-themes';
import { ROUND_STATUSES } from './use-crash-round';

const CANVAS_HEIGHT = 190;
const SURE_CHANCE = 0.99;
const MAX_FRAME_SECONDS = 0.05;
const MIN_SCALE = 1.5;
const SCALE_HEADROOM = 1.25;
const SMALL_ODDS_LIMIT = 4;
const SCALE_EASING = 0.08;
const EVENT_BANNER_MS = 1700;

const SHAKE = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-8px, 4px)' },
  { transform: 'translate(7px, -5px)' },
  { transform: 'translate(-5px, -3px)' },
  { transform: 'translate(4px, 3px)' },
  { transform: 'translate(0, 0)' },
];

const PULSE = [{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }];

const getMultiplierTier = multiplier => {
  if (multiplier >= 5) return 'isFire';
  if (multiplier >= 1.5) return 'isHot';
  if (multiplier < 1) return 'isCold';
  return null;
};

function formatChance(chance, isLive) {
  if (isLive && chance > SURE_CHANCE) return '99%+';
  if (isLive && chance > 0 && chance < 1 - SURE_CHANCE) return '<1%';

  return `${Math.round(chance * 100)}%`;
}

function useEventBanner(lastEvent) {
  const [banner, setBanner] = useState(null);
  const eventId = lastEvent?.id;

  useEffect(() => {
    if (eventId === undefined) {
      setBanner(null);
      return undefined;
    }

    setBanner(lastEvent);
    const timeoutId = setTimeout(() => setBanner(null), EVENT_BANNER_MS);

    return () => clearTimeout(timeoutId);
  }, [eventId]);

  return banner;
}

function getTargetScale(peak, maxMultiplier) {
  const oddsScale = maxMultiplier && maxMultiplier <= SMALL_ODDS_LIMIT ? maxMultiplier * 1.12 : 0;

  return Math.max(MIN_SCALE, peak * SCALE_HEADROOM, oddsScale);
}

function CrashStageUI({ round, historyRef, themeId, teamNames, result = null }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const roundRef = useRef(round);
  const banner = useEventBanner(round.lastEvent);
  const theme = THEMES[themeId];
  const themeRef = useRef(theme);

  roundRef.current = round;
  themeRef.current = theme;

  const isCrashed = round.phase === ROUND_PHASES.LOST;
  const isWon = round.phase === ROUND_PHASES.WON;
  const isIdle = round.status === ROUND_STATUSES.IDLE;
  const isCountdown = round.status === ROUND_STATUSES.COUNTDOWN;
  const isLive = round.status === ROUND_STATUSES.RUNNING;
  const isHotMinutes = isLive && round.minute >= HOT_MINUTE;
  const lastEventId = round.lastEvent?.id;
  const isBadGoal = round.lastEvent?.type === 'goal' && !round.lastEvent.isGood;
  const isGoodEvent = Boolean(round.lastEvent?.isGood);
  const { suspense } = round;

  useEffect(() => {
    if (isCrashed || isBadGoal) wrapperRef.current?.animate(SHAKE, { duration: 520, easing: 'ease-out' });
    else if (isGoodEvent || isWon) wrapperRef.current?.animate(PULSE, { duration: 380, easing: 'ease-out' });
  }, [lastEventId, isCrashed, isWon, isBadGoal, isGoodEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const colors = readCanvasColors(canvas);
    const confettiColors = [colors.primary, colors.promo, colors.success, colors.accent, colors.warn];
    let particles = [];
    let scale = MIN_SCALE;
    let lastTime = performance.now();
    let frameId = null;
    let seen = {};

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.parentElement.clientWidth;

      canvas.width = width * ratio;
      canvas.height = CANVAS_HEIGHT * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const burst = (origin, options) => particles.push(...createParticleBurst({ ...origin, ...options }));

    const emitEffects = (current, head, width) => {
      if (current.status === ROUND_STATUSES.RUNNING) {
        burst(head, {
          colors: [colors[themeRef.current.lineColor], colors[themeRef.current.gradientColor]],
          count: current.suspense ? 4 : 2,
          speed: current.suspense ? 120 : 60,
          angle: Math.PI,
          spread: current.suspense ? Math.PI * 2 : Math.PI / 2,
          life: 0.6,
          size: 4,
          shape: 'spark',
        });
      }

      const event = current.lastEvent;

      if (event && event.id !== seen.eventId) {
        if (event.type === 'goal' && event.isGood) {
          burst(head, {
            colors: confettiColors,
            count: 90,
            speed: 340,
            angle: -Math.PI / 2,
            spread: Math.PI * 1.4,
            life: 1.6,
            size: 9,
            shape: 'confetti',
          });
        } else if (event.type === 'goal') {
          burst(head, { colors: [colors.error, colors.warn], count: 60, speed: 260, life: 1, size: 6, shape: 'spark' });
        } else if (event.isGood) {
          burst(head, {
            colors: [colors.success, colors.primary],
            count: 40,
            speed: 200,
            life: 0.9,
            size: 5,
            shape: 'spark',
          });
        }
      }

      if (current.phase === ROUND_PHASES.LOST && seen.phase !== ROUND_PHASES.LOST) {
        burst(head, {
          colors: [colors.error, colors.warn, colors.promo],
          count: 120,
          speed: 400,
          life: 1.2,
          size: 7,
          shape: 'spark',
        });
      }

      if (current.phase === ROUND_PHASES.WON && seen.phase !== ROUND_PHASES.WON) {
        burst(
          { x: width / 2, y: CANVAS_HEIGHT },
          {
            colors: confettiColors,
            count: 170,
            speed: 540,
            angle: -Math.PI / 2,
            spread: Math.PI / 1.5,
            life: 2.2,
            size: 10,
            shape: 'confetti',
          }
        );
      }

      if (current.cashedOut && !seen.cashedOut) {
        burst(head, {
          colors: [colors.promo, colors.success],
          count: 45,
          speed: 300,
          angle: -Math.PI / 2,
          spread: Math.PI,
          life: 1.4,
          size: 8,
          shape: 'coin',
        });
      }
    };

    const render = now => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
      lastTime = now;

      const { current } = roundRef;
      const history = historyRef.current;
      const isRoundIdle = current.status === ROUND_STATUSES.IDLE || current.status === ROUND_STATUSES.COUNTDOWN;
      const peak = history.reduce((max, point) => Math.max(max, point.multiplier), 1);

      if (current.status === ROUND_STATUSES.IDLE && seen.status && seen.status !== ROUND_STATUSES.IDLE) {
        particles = [];
        seen = {};
      }

      if (current.status === ROUND_STATUSES.COUNTDOWN && seen.status !== ROUND_STATUSES.COUNTDOWN) {
        scale = getTargetScale(1, current.maxMultiplier);
        particles = [];
        seen = {};
      }

      scale += (getTargetScale(peak, current.maxMultiplier) - scale) * SCALE_EASING;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const geometry = createGeometry(width, CANVAS_HEIGHT, scale);

      if (!isRoundIdle) emitEffects(current, getHeadPosition(geometry, history), width);

      seen = {
        eventId: current.lastEvent?.id,
        phase: current.phase,
        cashedOut: current.cashedOut,
        status: current.status,
      };

      const view = {
        isIdle: isRoundIdle,
        isCrashed: current.phase === ROUND_PHASES.LOST,
        isSuspense: Boolean(current.suspense),
        cashOut: current.cashedOut,
        maxMultiplier: current.maxMultiplier,
        theme: themeRef.current,
        passedCheckpoints: isRoundIdle ? [] : CHECKPOINTS.filter(checkpoint => checkpoint <= current.minute),
      };

      particles = updateParticles(particles, deltaSeconds);
      drawFrame(context, { geometry, colors, view, history, particles, time: now / 1000 });
      frameId = requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(resize);

    resize();
    resizeObserver.observe(canvas.parentElement);
    frameId = requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, [historyRef]);

  const isEnded = isCrashed || isWon;
  const isStarted = !isIdle && !isCountdown;

  return (
    <div
      ref={wrapperRef}
      className={clsx(
        'sb-CrashStage',
        isCrashed && 'isCrashed',
        isWon && 'isWon',
        suspense && (suspense.isThreat ? 'isThreat' : 'isChance'),
        isHotMinutes && 'isHotMinutes'
      )}
      data-test-id="crash-stage">
      <div className="sb-CrashStage-hud">
        <div className="sb-CrashStage-hudRow">
          <span className="sb-CrashStage-chance">
            {isStarted && round.chance !== null && (
              `Chance ${formatChance(round.chance, isLive)}`
            )}
          </span>
          <span className="sb-CrashStage-clock">
            {isLive && <span className="sb-CrashStage-liveDot" />}
            {isStarted && `${getMatchClockMinute(round.minute)}'`}
          </span>
        </div>

        <div className="sb-CrashStage-value">
          {isCountdown && (
            <span key={round.countdown} className="sb-CrashStage-countdown">
              {round.countdown}
            </span>
          )}
          {isIdle && <span className="sb-CrashStage-ready">1.00x</span>}
          {isStarted && (
            <span
              key={Math.floor(round.multiplier * 2)}
              className={clsx(
                'sb-CrashStage-multiplier',
                getMultiplierTier(round.multiplier),
                isCrashed && 'isCrashed'
              )}>
              {round.multiplier.toFixed(2)}x
            </span>
          )}
        </div>

        <div className="sb-CrashStage-eventSlot">
          {suspense && (
            <div
              key={suspense.id}
              className={clsx('sb-CrashStage-suspense', suspense.isThreat ? 'isThreat' : 'isChance')}
              data-test-id="crash-suspense">
              <span className="sb-CrashStage-suspenseTitle">
                {getSuspenseText(suspense.type, teamNames[suspense.team])}
              </span>
              <span className="sb-CrashStage-suspenseBar">
                <span
                  className="sb-CrashStage-suspenseFill"
                  style={{ transform: `scaleX(${1 - suspense.progress})` }}
                />
              </span>
            </div>
          )}

          {!suspense && !isEnded && banner && (
            <div
              key={banner.id}
              className={clsx('sb-CrashStage-banner', banner.isGood ? 'isGood' : 'isBad')}
              data-test-id="crash-event-banner">
              {banner.type === 'goal' ? (
                `GOAL! ${teamNames[banner.team]} ${getMatchClockMinute(banner.minute)}'`
              ) : (
                getMissText(banner.type)
              )}
            </div>
          )}

          {isEnded && (
            <div className={clsx('sb-CrashStage-banner', 'isFinal', isWon ? 'isGood' : 'isBad')}>
              {isWon ? 'FULL TIME · WIN' : 'FULL TIME · LOST'}
            </div>
          )}

          {isEnded && result && (
            <span
              className={clsx('sb-CrashStage-result', result.isWin ? 'isWin' : 'isLoss')}
              data-test-id="crash-result">
              {result.amount > 0 ? '+' : '−'}
              {Math.abs(result.amount).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="sb-CrashStage-plot">
        <canvas ref={canvasRef} className="sb-CrashStage-canvas" />
      </div>
    </div>
  );
}

export const CrashStage = memo(CrashStageUI);
