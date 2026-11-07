import {
  calibrateMatch,
  checkOutcome,
  generateMatchEvents,
  getRoundStateAt,
  MATCH_DURATION_MS,
  ROUND_PHASES,
  SUSPENSE_MS,
} from '../src/crash/crash-engine.js';
import { OUTCOME_KINDS, SIDES } from '../src/crash/crash-outcomes.js';

const FINAL_MS = MATCH_DURATION_MS + 30 * SUSPENSE_MS;
const STEP_MS = 100;
const ROUNDS = Number(process.env.ROUNDS ?? 1500);

const createSeededRng = seed => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const OUTCOMES = [
  ['home win 2.10', { kind: OUTCOME_KINDS.WIN, side: SIDES.HOME, line: null, odds: 2.1 }],
  ['draw 3.40', { kind: OUTCOME_KINDS.DRAW, side: null, line: null, odds: 3.4 }],
  ['X2 1.75', { kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.AWAY, line: null, odds: 1.75 }],
  ['handicap -1.5 4.20', { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: -1.5, odds: 4.2 }],
  ['over 2.5 1.95', { kind: OUTCOME_KINDS.OVER, side: null, line: 2.5, odds: 1.95 }],
  ['under 2.5 1.85', { kind: OUTCOME_KINDS.UNDER, side: null, line: 2.5, odds: 1.85 }],
  ['draw 15 (forced)', { kind: OUTCOME_KINDS.DRAW, side: null, line: null, odds: 15 }],
  ['home win 80 (forced)', { kind: OUTCOME_KINDS.WIN, side: SIDES.HOME, line: null, odds: 80 }],
  ['handicap +3.5 at 6 (forced)', { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: 3.5, odds: 6 }],
];

const STRATEGIES = {
  hold: () => false,
  'cash out at a threat window': state => Boolean(state.suspense?.isThreat),
  'cash out at a chance window': state => Boolean(state.suspense && !state.suspense.isThreat),
  'cash out at x >= 1.2': state => state.multiplier >= 1.2,
  'cash out after a good goal': state => state.lastEvent?.type === 'goal' && state.lastEvent.isGood,
  'cash out at 85 in profit': state => state.minute >= 85 && state.multiplier > 1,
};

function play(round, shouldCashOut) {
  for (let elapsed = 0; elapsed < FINAL_MS; elapsed += STEP_MS) {
    const state = getRoundStateAt(round, elapsed);

    if (state.phase !== ROUND_PHASES.RUNNING || shouldCashOut(state)) return state.multiplier;
  }

  return getRoundStateAt(round, FINAL_MS).multiplier;
}

console.log(
  `Average return per 1 staked ± standard error, ${ROUNDS} rounds per cell. ` +
    'HOLE marks a cell whose average minus two standard errors is still at or above 1.\n'
);

for (const [name, outcome] of OUTCOMES) {
  const calibration = calibrateMatch(outcome);
  const { isEligible, reason } = checkOutcome(outcome);

  console.log(
    `${name} | eligible: ${isEligible ? 'yes' : `no (${reason})`} | payout cap ${calibration.payoutScale} | ` +
      `start chance ${calibration.startChance.toFixed(4)}`
  );

  Object.entries(STRATEGIES).forEach(([strategyName, strategy]) => {
    const rng = createSeededRng(7);
    let sum = 0;
    let sumOfSquares = 0;

    for (let index = 0; index < ROUNDS; index += 1) {
      const value = play({ ...calibration, outcome, events: generateMatchEvents(calibration.rates, rng) }, strategy);

      sum += value;
      sumOfSquares += value * value;
    }

    const mean = sum / ROUNDS;
    const standardError = Math.sqrt((sumOfSquares / ROUNDS - mean * mean) / ROUNDS);
    const flag = mean - 2 * standardError >= 1 ? '  HOLE' : '';

    console.log(`  ${strategyName}: ${mean.toFixed(3)} ± ${standardError.toFixed(3)}${flag}`);
  });
}
