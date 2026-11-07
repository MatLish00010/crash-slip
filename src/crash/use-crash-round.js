import { useCallback, useEffect, useRef, useState } from 'react';

import { createRound, getPayout, getRoundStateAt, KICKOFF_DELAY_MS, ROUND_PHASES } from './crash-engine';

export const ROUND_STATUSES = {
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  RUNNING: 'running',
  ENDED: 'ended',
};

const COUNTDOWN_STEP_MS = KICKOFF_DELAY_MS / 3;
const HISTORY_MIN_GAP = 0.004;

const IDLE_STATE = {
  status: ROUND_STATUSES.IDLE,
  countdown: 0,
  phase: null,
  minute: 0,
  multiplier: 1,
  chance: null,
  maxMultiplier: null,
  score: { home: 0, away: 0 },
  suspense: null,
  lastEvent: null,
  stake: 0,
  cashedOut: null,
};

export function useCrashRound({ onRoundEnd }) {
  const [state, setState] = useState(IDLE_STATE);
  const roundRef = useRef(null);
  const frameRef = useRef(null);
  const liveRef = useRef(IDLE_STATE);
  const historyRef = useRef([]);
  const onRoundEndRef = useRef(onRoundEnd);

  onRoundEndRef.current = onRoundEnd;

  const publish = useCallback(nextState => {
    liveRef.current = nextState;
    setState(nextState);
  }, []);

  const stopLoop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const recordHistory = useCallback(({ minute, multiplier }) => {
    const history = historyRef.current;
    const last = history[history.length - 1];

    if (!last || Math.abs(last.multiplier - multiplier) > HISTORY_MIN_GAP || minute - last.minute > 0.2) {
      history.push({ minute, multiplier });
    }
  }, []);

  const cashOut = useCallback(() => {
    const { current } = liveRef;

    if (current.status !== ROUND_STATUSES.RUNNING || current.cashedOut) return;

    publish({
      ...current,
      cashedOut: {
        multiplier: current.multiplier,
        minute: current.minute,
        payout: getPayout(current.stake, current.multiplier),
      },
    });
  }, [publish]);

  const start = useCallback(
    ({ stake, autoCashOut, outcome }) => {
      stopLoop();
      historyRef.current = [];

      const round = createRound(outcome);
      const maxMultiplier = outcome.odds;
      const startedAt = performance.now();
      roundRef.current = round;

      publish({ ...IDLE_STATE, status: ROUND_STATUSES.COUNTDOWN, countdown: 3, stake, maxMultiplier });

      const tick = now => {
        const elapsed = now - startedAt;
        const { current } = liveRef;

        if (elapsed < KICKOFF_DELAY_MS) {
          publish({ ...current, countdown: Math.ceil((KICKOFF_DELAY_MS - elapsed) / COUNTDOWN_STEP_MS) });
          frameRef.current = requestAnimationFrame(tick);
          return;
        }

        const roundState = getRoundStateAt(round, elapsed - KICKOFF_DELAY_MS);
        const isRunning = roundState.phase === ROUND_PHASES.RUNNING;
        const shouldAutoCashOut =
          isRunning && !current.cashedOut && autoCashOut && roundState.multiplier >= autoCashOut;
        const cashedOut = shouldAutoCashOut
          ? { multiplier: autoCashOut, minute: roundState.minute, payout: getPayout(stake, autoCashOut), isAuto: true }
          : current.cashedOut;

        recordHistory(roundState);

        const nextState = {
          ...current,
          ...roundState,
          status: isRunning ? ROUND_STATUSES.RUNNING : ROUND_STATUSES.ENDED,
          cashedOut,
        };

        publish(nextState);

        if (isRunning) {
          frameRef.current = requestAnimationFrame(tick);
          return;
        }

        frameRef.current = null;
        onRoundEndRef.current?.(nextState);
      };

      frameRef.current = requestAnimationFrame(tick);
    },
    [publish, recordHistory, stopLoop]
  );

  useEffect(() => stopLoop, [stopLoop]);

  return { state, historyRef, start, cashOut };
}
