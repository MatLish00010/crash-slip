import { CALIBRATION, getRules, OUTCOME_KINDS, SIDES } from './crash-outcomes';

export const MATCH_MINUTES = 90;
export const MATCH_DURATION_MS = 26000;
export const KICKOFF_DELAY_MS = 1800;
export const SUSPENSE_MS = 2200;
export const MS_PER_MINUTE = MATCH_DURATION_MS / MATCH_MINUTES;

export const CHECKPOINTS = [15, 30, 45, 60, 75, 90];
export const HOT_MINUTE = 80;

export const HOUSE_EDGE = 0.05;

export const ODDS_RANGE = [1.05, 30];
export const MAX_HANDICAP_LINE = 2.5;
export const MAX_TOTAL_LINE = 6.5;
export const CALIBRATION_TOLERANCE = 0.02;

export const INELIGIBILITY_REASONS = {
  ODDS: 'odds',
  LINE: 'line',
  CALIBRATION: 'calibration',
};

const TABLE_STEP_MINUTES = 0.5;
const TABLE_STEPS = MATCH_MINUTES / TABLE_STEP_MINUTES;
const MAX_GOALS = 10;
const SCORE_STATES = MAX_GOALS + 1;

const DEFAULT_TOTAL_GOALS = 2.7;
const STRENGTH_RANGE = [0.04, 0.96];
const GOALS_RANGE = [0.4, 7];
const CALIBRATION_ITERATIONS = 32;
const TARGET_CHANCE_RANGE = [0.02, 0.95];

export const SUSPENSE_TYPES = {
  PENALTY: 'penalty',
  VAR: 'var',
  ATTACK: 'attack',
};

const SUSPENSE_SETTINGS = {
  [SUSPENSE_TYPES.PENALTY]: { goalChance: 0.76, shareOfGoals: 0.12 },
  [SUSPENSE_TYPES.VAR]: { goalChance: 0.55, shareOfGoals: 0.18 },
  [SUSPENSE_TYPES.ATTACK]: { goalChance: 0.3, shareOfGoals: 0.3 },
};

export const ROUND_PHASES = {
  RUNNING: 'running',
  WON: 'won',
  LOST: 'lost',
};

export const floorMultiplier = value => Math.floor(value * 100) / 100;

export const getPayout = (stake, multiplier) => Math.floor(stake * multiplier * 100) / 100;

export const getMatchClockMinute = minute => Math.min(MATCH_MINUTES, Math.floor(minute) + 1);

export const getTargetChance = odds => {
  const [minChance, maxChance] = TARGET_CHANCE_RANGE;

  return Math.min(Math.max((1 - HOUSE_EDGE) / odds, minChance), maxChance);
};

const tableIndex = (step, home, away) => (step * SCORE_STATES + home) * SCORE_STATES + away;

export function buildValueTable(outcome, { home: homeRate, away: awayRate }) {
  const rules = getRules(outcome);
  const table = new Float64Array((TABLE_STEPS + 1) * SCORE_STATES * SCORE_STATES);
  const homeChance = (homeRate * TABLE_STEP_MINUTES) / MATCH_MINUTES;
  const awayChance = (awayRate * TABLE_STEP_MINUTES) / MATCH_MINUTES;

  for (let home = 0; home < SCORE_STATES; home += 1) {
    for (let away = 0; away < SCORE_STATES; away += 1) {
      table[tableIndex(TABLE_STEPS, home, away)] = rules.isWinAtFullTime(outcome, home, away) ? 1 : 0;
    }
  }

  for (let step = TABLE_STEPS - 1; step >= 0; step -= 1) {
    for (let home = 0; home < SCORE_STATES; home += 1) {
      for (let away = 0; away < SCORE_STATES; away += 1) {
        const stay = table[tableIndex(step + 1, home, away)];
        const homeScores = table[tableIndex(step + 1, Math.min(home + 1, MAX_GOALS), away)];
        const awayScores = table[tableIndex(step + 1, home, Math.min(away + 1, MAX_GOALS))];

        table[tableIndex(step, home, away)] =
          homeChance * homeScores + awayChance * awayScores + (1 - homeChance - awayChance) * stay;
      }
    }
  }

  return table;
}

export function getTableValue(table, minute, home, away) {
  const clampedHome = Math.min(home, MAX_GOALS);
  const clampedAway = Math.min(away, MAX_GOALS);
  const position = Math.min(Math.max(minute, 0), MATCH_MINUTES) / TABLE_STEP_MINUTES;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, TABLE_STEPS);
  const weight = position - lower;

  return (
    table[tableIndex(lower, clampedHome, clampedAway)] * (1 - weight) +
    table[tableIndex(upper, clampedHome, clampedAway)] * weight
  );
}

function getRatesForParameter(outcome, parameter) {
  if (getRules(outcome).calibration === CALIBRATION.GOALS) return { home: parameter / 2, away: parameter / 2 };

  const ownRate = DEFAULT_TOTAL_GOALS * parameter;
  const opponentRate = DEFAULT_TOTAL_GOALS - ownRate;

  return outcome.side === SIDES.AWAY ? { home: opponentRate, away: ownRate } : { home: ownRate, away: opponentRate };
}

const getStartChance = (outcome, rates) => buildValueTable(outcome, rates)[tableIndex(0, 0, 0)];

const calibrationCache = new Map();

const getCalibrationKey = outcome => [outcome.kind, outcome.side, outcome.line, outcome.odds].join('|');

export function calibrateMatch(outcome) {
  const key = getCalibrationKey(outcome);

  if (!calibrationCache.has(key)) calibrationCache.set(key, runCalibration(outcome));

  return calibrationCache.get(key);
}

function runCalibration(outcome) {
  const targetChance = getTargetChance(outcome.odds);
  let [low, high] = getRules(outcome).calibration === CALIBRATION.GOALS ? GOALS_RANGE : STRENGTH_RANGE;
  const isIncreasing =
    getStartChance(outcome, getRatesForParameter(outcome, high)) >
    getStartChance(outcome, getRatesForParameter(outcome, low));

  for (let iteration = 0; iteration < CALIBRATION_ITERATIONS; iteration += 1) {
    const middle = (low + high) / 2;
    const chance = getStartChance(outcome, getRatesForParameter(outcome, middle));

    if (chance < targetChance === isIncreasing) low = middle;
    else high = middle;
  }

  const rates = getRatesForParameter(outcome, (low + high) / 2);
  const table = buildValueTable(outcome, rates);
  const startChance = table[tableIndex(0, 0, 0)];

  return {
    rates,
    table,
    startChance,
    payoutScale: Math.min(outcome.odds, Math.ceil(((1 - HOUSE_EDGE) / startChance) * 100) / 100),
    calibrationError: Math.abs(startChance - targetChance) / targetChance,
  };
}

const isHalfLine = line => Math.abs(line % 1) === 0.5;

function isLineAllowed(outcome) {
  if (outcome.line === null) return true;
  if (!isHalfLine(outcome.line)) return false;

  const limit = outcome.kind === OUTCOME_KINDS.HANDICAP ? MAX_HANDICAP_LINE : MAX_TOTAL_LINE;

  return Math.abs(outcome.line) <= limit && (outcome.kind === OUTCOME_KINDS.HANDICAP || outcome.line > 0);
}

export function checkOutcome(outcome) {
  const [minOdds, maxOdds] = ODDS_RANGE;

  if (!(outcome.odds >= minOdds && outcome.odds <= maxOdds)) {
    return { isEligible: false, reason: INELIGIBILITY_REASONS.ODDS };
  }

  if (!isLineAllowed(outcome)) return { isEligible: false, reason: INELIGIBILITY_REASONS.LINE };

  if (calibrateMatch(outcome).calibrationError > CALIBRATION_TOLERANCE) {
    return { isEligible: false, reason: INELIGIBILITY_REASONS.CALIBRATION };
  }

  return { isEligible: true, reason: null };
}

const sampleExponential = (rate, rng) => -Math.log(1 - rng()) / rate;

function samplePoissonMinutes(ratePerMatch, rng) {
  const minutes = [];
  const ratePerMinute = ratePerMatch / MATCH_MINUTES;

  if (ratePerMinute <= 0) return minutes;

  let minute = sampleExponential(ratePerMinute, rng);

  while (minute < MATCH_MINUTES) {
    minutes.push(minute);
    minute += sampleExponential(ratePerMinute, rng);
  }

  return minutes;
}

function pickSuspenseType(rng) {
  let roll = rng();

  for (const [type, settings] of Object.entries(SUSPENSE_SETTINGS)) {
    if (roll < settings.shareOfGoals) return type;
    roll -= settings.shareOfGoals;
  }

  return null;
}

export function generateMatchEvents(rates, rng = Math.random) {
  const events = [];

  [SIDES.HOME, SIDES.AWAY].forEach(team => {
    samplePoissonMinutes(rates[team], rng).forEach(minute =>
      events.push({ minute, team, isGoal: true, suspense: pickSuspenseType(rng) })
    );

    Object.entries(SUSPENSE_SETTINGS).forEach(([type, { goalChance, shareOfGoals }]) => {
      const falseAlarmRate = (rates[team] * shareOfGoals * (1 - goalChance)) / goalChance;

      samplePoissonMinutes(falseAlarmRate, rng).forEach(minute =>
        events.push({ minute, team, isGoal: false, suspense: type })
      );
    });
  });

  return events.sort((first, second) => first.minute - second.minute);
}

export function createRound(outcome, rng = Math.random) {
  const { rates, table, startChance, payoutScale } = calibrateMatch(outcome);

  return { outcome, rates, table, startChance, payoutScale, events: generateMatchEvents(rates, rng) };
}

const applyGoal = (score, team) => ({ ...score, [team]: score[team] + 1 });

const getChance = (round, minute, score) => getTableValue(round.table, minute, score.home, score.away);

function describeState(round, { minute, score, phase, suspense = null, lastEvent = null, chance }) {
  return {
    phase,
    minute,
    score,
    suspense,
    lastEvent,
    chance,
    multiplier: floorMultiplier(round.payoutScale * chance),
  };
}

function describeRunning(round, minute, score, lastEvent) {
  return describeState(round, {
    minute,
    score,
    phase: ROUND_PHASES.RUNNING,
    lastEvent,
    chance: getChance(round, minute, score),
  });
}

export function getRoundStateAt(round, elapsedMs) {
  let score = { home: 0, away: 0 };
  let pausedMs = 0;
  let lastEvent = null;

  for (let index = 0; index < round.events.length; index += 1) {
    const event = round.events[index];
    const eventStartMs = event.minute * MS_PER_MINUTE + pausedMs;

    if (elapsedMs < eventStartMs) {
      return describeRunning(round, (elapsedMs - pausedMs) / MS_PER_MINUTE, score, lastEvent);
    }

    const chanceIfGoal = getChance(round, event.minute, applyGoal(score, event.team));
    const chanceIfNot = getChance(round, event.minute, score);

    if (event.suspense) {
      const { goalChance } = SUSPENSE_SETTINGS[event.suspense];

      if (elapsedMs < eventStartMs + SUSPENSE_MS) {
        return describeState(round, {
          minute: event.minute,
          score,
          phase: ROUND_PHASES.RUNNING,
          lastEvent,
          suspense: {
            id: index,
            type: event.suspense,
            team: event.team,
            progress: (elapsedMs - eventStartMs) / SUSPENSE_MS,
            isThreat: chanceIfGoal < chanceIfNot,
          },
          chance: goalChance * chanceIfGoal + (1 - goalChance) * chanceIfNot,
        });
      }

      pausedMs += SUSPENSE_MS;
    }

    if (event.isGoal) {
      score = applyGoal(score, event.team);
      lastEvent = { id: index, type: 'goal', team: event.team, minute: event.minute, isGood: chanceIfGoal >= chanceIfNot };
    } else {
      lastEvent = {
        id: index,
        type: event.suspense,
        team: event.team,
        minute: event.minute,
        isGood: chanceIfGoal < chanceIfNot,
        isMiss: true,
      };
    }
  }

  const minute = (elapsedMs - pausedMs) / MS_PER_MINUTE;

  if (minute < MATCH_MINUTES) return describeRunning(round, minute, score, lastEvent);

  const isWin = getRules(round.outcome).isWinAtFullTime(round.outcome, score.home, score.away);

  return describeState(round, {
    minute: MATCH_MINUTES,
    score,
    phase: isWin ? ROUND_PHASES.WON : ROUND_PHASES.LOST,
    lastEvent,
    chance: isWin ? 1 : 0,
  });
}
