import clsx from 'clsx';
import { memo, useCallback, useMemo, useState } from 'react';

import { checkOutcome, getPayout, INELIGIBILITY_REASONS, MAX_HANDICAP_LINE, MAX_TOTAL_LINE, ODDS_RANGE, ROUND_PHASES } from './crash-engine';
import { getThemeId, SIDES } from './crash-outcomes';
import { CrashStage } from './crash-stage';
import { TeamBadge } from './team-badge';
import { ROUND_STATUSES, useCrashRound } from './use-crash-round';

import './crash-game.scss';

const STAKE_CHIPS = [10, 25, 50, 100];
const AUTO_CASH_OUT_CHIPS = [null, 1.2, 1.5, 2, 3];
const DEFAULT_STAKE = 25;

const formatCoins = value => value.toFixed(2);

const INELIGIBILITY_TEXTS = {
  [INELIGIBILITY_REASONS.ODDS]: `Crash runs on odds from ${ODDS_RANGE[0]} to ${ODDS_RANGE[1]}.`,
  [INELIGIBILITY_REASONS.LINE]: `Crash runs on half lines only: handicap up to ±${MAX_HANDICAP_LINE}, total up to ${MAX_TOTAL_LINE}.`,
  [INELIGIBILITY_REASONS.CALIBRATION]: 'The match model cannot price these odds fairly.',
};

function CrashGameUI({ pick }) {
  const [playedPick, setPlayedPick] = useState(null);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [autoCashOut, setAutoCashOut] = useState(null);
  const { state: round, historyRef, start, cashOut } = useCrashRound({});

  const isRunning = round.status === ROUND_STATUSES.RUNNING;
  const isBusy = round.status === ROUND_STATUSES.COUNTDOWN || isRunning;
  const isEnded = round.status === ROUND_STATUSES.ENDED;
  const isShowingPlayed = isBusy || (isEnded && Boolean(pick) && playedPick?.selection === pick.selection);
  const shownPick = isShowingPlayed ? playedPick : pick;
  const eligibility = useMemo(() => (pick ? checkOutcome(pick.outcome) : null), [pick]);
  const pickOdds = pick?.outcome.odds ?? 0;
  const effectiveAutoCashOut = autoCashOut !== null && autoCashOut < pickOdds ? autoCashOut : null;

  const teamNames = useMemo(
    () => ({ [SIDES.HOME]: shownPick?.selection.nameA ?? '', [SIDES.AWAY]: shownPick?.selection.nameB ?? '' }),
    [shownPick]
  );

  const handlePlace = useCallback(() => {
    setPlayedPick(pick);
    start({ stake, autoCashOut: effectiveAutoCashOut, outcome: pick.outcome });
  }, [pick, start, stake, effectiveAutoCashOut]);

  if (!shownPick) {
    return (
      <div className="sb-CrashEmpty" data-test-id="crash-empty">
        <span className="sb-CrashEmpty-icon">🎯</span>
        <span className="sb-CrashEmpty-title">Pick an outcome</span>
        <span className="sb-CrashEmpty-text">
          Add a 1x2, double chance, handicap or total outcome from the list to play it as a crash.
        </span>
      </div>
    );
  }

  if (!isShowingPlayed && !eligibility.isEligible) {
    return (
      <div className="sb-CrashEmpty" data-test-id="crash-unavailable">
        <span className="sb-CrashEmpty-icon">🚫</span>
        <span className="sb-CrashEmpty-title">Not available as a crash</span>
        <span className="sb-CrashEmpty-text">{INELIGIBILITY_TEXTS[eligibility.reason]}</span>
      </div>
    );
  }

  const { selection, outcome } = shownPick;
  const roundForView = isShowingPlayed
    ? round
    : {
        ...round,
        status: ROUND_STATUSES.IDLE,
        phase: null,
        score: { home: 0, away: 0 },
        multiplier: 1,
        chance: null,
        suspense: null,
        lastEvent: null,
        cashedOut: null,
        maxMultiplier: outcome.odds,
      };
  const livePayout = getPayout(round.stake, round.multiplier);
  const isWon = round.phase === ROUND_PHASES.WON;
  const winAmount = round.cashedOut?.payout ?? (isWon ? livePayout : 0);
  const result = isShowingPlayed && isEnded ? { amount: winAmount || -round.stake, isWin: winAmount > 0 } : null;

  return (
    <div className="sb-CrashGame" data-test-id="crash-game">
      <div className="sb-CrashGame-match">
        {[SIDES.HOME, SIDES.AWAY].map(side => (
          <div key={side} className={clsx('sb-CrashGame-team', outcome.side === side && 'isActive')}>
            <TeamBadge name={teamNames[side]} colors={side === SIDES.HOME ? selection.colorsA : selection.colorsB} />
            <span className="sb-CrashGame-teamName">{teamNames[side]}</span>
          </div>
        ))}
        <div className={clsx('sb-CrashGame-score', roundForView.phase === ROUND_PHASES.LOST && 'isCrashed')}>
          {roundForView.score.home} : {roundForView.score.away}
        </div>
      </div>

      <div className="sb-CrashGame-pick">
        {selection.marketName} · {selection.outcomeName}
        <span className="sb-CrashGame-pickOdds">{outcome.odds.toFixed(2)}</span>
      </div>

      <CrashStage
        historyRef={historyRef}
        result={result}
        round={roundForView}
        teamNames={teamNames}
        themeId={getThemeId(outcome)}
      />

      {isRunning ? (
        <button
          className={clsx(
            'sb-Button',
            'sb-CrashGame-cashOut',
            round.cashedOut && 'isCashed',
            round.multiplier < 1 && 'isSave',
            round.suspense && 'isUrgent'
          )}
          data-test-id="crash-cash-out"
          disabled={Boolean(round.cashedOut)}
          type="button"
          onClick={cashOut}>
          {round.cashedOut ? (
            `Cashed ${round.cashedOut.multiplier.toFixed(2)}x · +${formatCoins(round.cashedOut.payout)}`
          ) : (
            <span className="sb-CrashGame-cashOutLabel">
              Cash out
              <span className="sb-CrashGame-cashOutAmount">{formatCoins(livePayout)}</span>
            </span>
          )}
        </button>
      ) : (
        <div className="sb-CrashGame-controls">
          <div className="sb-CrashGame-controlRow">
            <span className="sb-CrashGame-controlLabel">Stake</span>
            <div className="sb-CrashGame-chips">
              {STAKE_CHIPS.map(value => (
                <button
                  key={value}
                  className={clsx('sb-CrashGame-chip', stake === value && 'isActive')}
                  disabled={isBusy}
                  type="button"
                  onClick={() => setStake(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-CrashGame-controlRow">
            <span className="sb-CrashGame-controlLabel">Auto cash out</span>
            <div className="sb-CrashGame-chips">
              {AUTO_CASH_OUT_CHIPS.map(value => (
                <button
                  key={value ?? 'off'}
                  className={clsx('sb-CrashGame-chip', effectiveAutoCashOut === value && 'isActive')}
                  disabled={isBusy || (value !== null && value >= pickOdds)}
                  type="button"
                  onClick={() => setAutoCashOut(value)}>
                  {value ? `${value}x` : 'Off'}
                </button>
              ))}
            </div>
          </div>

          <button
            className="sb-Button sb-CrashGame-place"
            data-test-id="crash-place"
            disabled={isBusy || !pick}
            type="button"
            onClick={handlePlace}>
            Place · {stake}
          </button>
        </div>
      )}
    </div>
  );
}

export const CrashGame = memo(CrashGameUI);
