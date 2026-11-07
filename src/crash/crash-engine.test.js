import {
  calibrateMatch,
  checkOutcome,
  HOUSE_EDGE,
  INELIGIBILITY_REASONS,
  generateMatchEvents,
  getMatchClockMinute,
  getPayout,
  getRoundStateAt,
  MATCH_DURATION_MS,
  MS_PER_MINUTE,
  ROUND_PHASES,
  SUSPENSE_MS,
} from './crash-engine';
import { OUTCOME_KINDS, parseSlipOutcome, SIDES } from './crash-outcomes';
import { MATCHES, toSlipSelection } from '../data/matches';

const DEMO_OUTCOMES = [
  { id: 'demo-home', kind: OUTCOME_KINDS.WIN, side: SIDES.HOME, line: null, odds: 2.1, label: '1' },
  { id: 'demo-draw', kind: OUTCOME_KINDS.DRAW, side: null, line: null, odds: 3.4, label: 'X' },
  { id: 'demo-away', kind: OUTCOME_KINDS.WIN, side: SIDES.AWAY, line: null, odds: 3.6, label: '2' },
  { id: 'demo-1x', kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.HOME, line: null, odds: 1.3, label: '1X' },
  { id: 'demo-12', kind: OUTCOME_KINDS.NO_DRAW, side: null, line: null, odds: 1.33, label: '12' },
  { id: 'demo-x2', kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.AWAY, line: null, odds: 1.75, label: 'X2' },
  { id: 'demo-hcp-minus', kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: -1.5, odds: 4.2, label: 'H1 −1.5' },
  { id: 'demo-hcp-plus', kind: OUTCOME_KINDS.HANDICAP, side: SIDES.AWAY, line: 1.5, odds: 1.3, label: 'H2 +1.5' },
  { id: 'demo-over', kind: OUTCOME_KINDS.OVER, side: null, line: 2.5, odds: 1.95, label: 'O 2.5' },
  { id: 'demo-under', kind: OUTCOME_KINDS.UNDER, side: null, line: 2.5, odds: 1.85, label: 'U 2.5' },
];

const createSeededRng = seed => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const findDemoOutcome = id => DEMO_OUTCOMES.find(outcome => outcome.id === id);

const createScriptedRound = (outcome, events) => ({ ...calibrateMatch(outcome), outcome, events });

const FINAL_MS = MATCH_DURATION_MS + 20 * SUSPENSE_MS;

describe('parseSlipOutcome', () => {
  test.each([
    { market: 1, outcome: '1', specifier: '', expected: { kind: OUTCOME_KINDS.WIN, side: SIDES.HOME, line: null } },
    { market: 1, outcome: '2', specifier: '', expected: { kind: OUTCOME_KINDS.DRAW, side: null, line: null } },
    {
      market: 10,
      outcome: '11',
      specifier: '',
      expected: { kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.AWAY, line: null },
    },
    {
      market: 16,
      outcome: '1715',
      specifier: 'hcp=-0.5',
      expected: { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.AWAY, line: 0.5 },
    },
    {
      market: 18,
      outcome: '13',
      specifier: 'total=2.5',
      expected: { kind: OUTCOME_KINDS.UNDER, side: null, line: 2.5 },
    },
  ])('reads market $market outcome $outcome', ({ market, outcome, specifier, expected }) => {
    const parsed = parseSlipOutcome({
      id: 'x',
      marketExternalId: market,
      outcomeExternalId: outcome,
      specifier,
      odds: 1850,
    });

    expect(parsed).toMatchObject({ ...expected, odds: 1.85 });
  });

  test('returns null for a market without a theme', () => {
    expect(parseSlipOutcome({ id: 'x', marketExternalId: 29, outcomeExternalId: '74', odds: 1500 })).toBeNull();
  });
});

describe('calibrateMatch', () => {
  test.each(DEMO_OUTCOMES.map(outcome => [outcome.id, outcome]))(
    'sets the start chance below the odds by the house edge for %s',
    (id, outcome) => {
      expect(calibrateMatch(outcome).startChance).toBeCloseTo((1 - HOUSE_EDGE) / outcome.odds, 2);
    }
  );

  test('gives the underdog the weaker side', () => {
    const favourite = calibrateMatch({ ...findDemoOutcome('demo-home'), odds: 1.4 });
    const underdog = calibrateMatch({ ...findDemoOutcome('demo-home'), odds: 5 });

    expect(favourite.rates.home).toBeGreaterThan(favourite.rates.away);
    expect(underdog.rates.home).toBeLessThan(underdog.rates.away);
  });
});

describe('getRoundStateAt', () => {
  test('starts every round just below the stake', () => {
    const round = createScriptedRound(findDemoOutcome('demo-home'), []);

    expect(getRoundStateAt(round, 0).multiplier).toBeCloseTo(1 - HOUSE_EDGE, 1);
  });

  test('keeps playing when the opponent scores and drops the multiplier', () => {
    const round = createScriptedRound(findDemoOutcome('demo-home'), [
      { minute: 10, team: SIDES.AWAY, isGoal: true, suspense: null },
    ]);
    const before = getRoundStateAt(round, 9 * MS_PER_MINUTE);
    const after = getRoundStateAt(round, 11 * MS_PER_MINUTE);

    expect(after.phase).toBe(ROUND_PHASES.RUNNING);
    expect(after.multiplier).toBeLessThan(before.multiplier);
    expect(after.multiplier).toBeGreaterThan(0);
  });

  test('moves the multiplier with the score: behind, level, ahead', () => {
    const round = createScriptedRound(findDemoOutcome('demo-home'), [
      { minute: 10, team: SIDES.AWAY, isGoal: true, suspense: null },
      { minute: 20, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 30, team: SIDES.HOME, isGoal: true, suspense: null },
    ]);
    const behind = getRoundStateAt(round, 15 * MS_PER_MINUTE).multiplier;
    const level = getRoundStateAt(round, 25 * MS_PER_MINUTE).multiplier;
    const ahead = getRoundStateAt(round, 35 * MS_PER_MINUTE).multiplier;

    expect(behind).toBeLessThan(level);
    expect(level).toBeLessThan(1);
    expect(ahead).toBeGreaterThan(1);
  });

  test('locks the rocket at the full odds after the goal over the line and plays to full time', () => {
    const outcome = findDemoOutcome('demo-over');
    const round = createScriptedRound(outcome, [
      { minute: 5, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 6, team: SIDES.AWAY, isGoal: true, suspense: null },
      { minute: 7, team: SIDES.HOME, isGoal: true, suspense: null },
    ]);

    expect(getRoundStateAt(round, 8 * MS_PER_MINUTE)).toMatchObject({
      phase: ROUND_PHASES.RUNNING,
      multiplier: outcome.odds,
    });
    expect(getRoundStateAt(round, FINAL_MS)).toMatchObject({ phase: ROUND_PHASES.WON, multiplier: outcome.odds });
  });

  test('drops the vault to zero after the goal over the line and loses at full time', () => {
    const round = createScriptedRound(findDemoOutcome('demo-under'), [
      { minute: 5, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 6, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 7, team: SIDES.AWAY, isGoal: true, suspense: null },
    ]);

    expect(getRoundStateAt(round, 8 * MS_PER_MINUTE)).toMatchObject({ phase: ROUND_PHASES.RUNNING, multiplier: 0 });
    expect(getRoundStateAt(round, FINAL_MS).phase).toBe(ROUND_PHASES.LOST);
  });

  test('freezes the clock during a penalty and prices the chance of a goal', () => {
    const round = createScriptedRound(findDemoOutcome('demo-home'), [
      { minute: 30, team: SIDES.AWAY, isGoal: false, suspense: 'penalty' },
    ]);
    const duringPenalty = getRoundStateAt(round, 30 * MS_PER_MINUTE + SUSPENSE_MS / 2);
    const afterSave = getRoundStateAt(round, 31 * MS_PER_MINUTE + SUSPENSE_MS);

    expect(duringPenalty).toMatchObject({ minute: 30, suspense: { type: 'penalty', isThreat: true } });
    expect(duringPenalty.multiplier).toBeLessThan(afterSave.multiplier);
    expect(afterSave.lastEvent).toMatchObject({ isMiss: true, isGood: true });
  });

  test('pays the full odds when the outcome wins at full time', () => {
    const outcome = findDemoOutcome('demo-draw');
    const round = createScriptedRound(outcome, []);

    expect(getRoundStateAt(round, FINAL_MS)).toMatchObject({ phase: ROUND_PHASES.WON, minute: 90, multiplier: 3.4 });
  });
});

const STRATEGIES = {
  'holds to full time': () => null,
  'cashes out at 40 minutes': () => 40,
  'cashes out at the first multiplier above 1.1': round => {
    for (let minute = 1; minute < 90; minute += 1) {
      if (getRoundStateAt(round, minute * MS_PER_MINUTE).multiplier > 1.1) return minute;
    }

    return null;
  },
};

describe.each(['demo-home', 'demo-x2', 'demo-hcp-minus', 'demo-over', 'demo-under'])('house edge for %s', id => {
  test.each(Object.keys(STRATEGIES))('a player who %s gets back less than the stake on average', strategyName => {
    const outcome = findDemoOutcome(id);
    const calibration = calibrateMatch(outcome);
    const rng = createSeededRng(11);
    const rounds = 3000;
    let returned = 0;

    for (let index = 0; index < rounds; index += 1) {
      const round = { ...calibration, outcome, events: generateMatchEvents(calibration.rates, rng) };
      const cashOutMinute = STRATEGIES[strategyName](round);
      const state = getRoundStateAt(round, cashOutMinute === null ? FINAL_MS : cashOutMinute * MS_PER_MINUTE);

      returned += state.multiplier;
    }

    expect(returned / rounds).toBeGreaterThan(0.88);
    expect(returned / rounds).toBeLessThan(1);
  });
});

test('formats the match clock and floors the payout', () => {
  expect(getMatchClockMinute(11.4)).toBe(12);
  expect(getMatchClockMinute(95)).toBe(90);
  expect(getPayout(10, 2.345)).toBe(23.45);
});

const EXTREME_OUTCOMES = {
  'draw at 15': { kind: OUTCOME_KINDS.DRAW, side: null, line: null, odds: 15 },
  'home win at 80': { kind: OUTCOME_KINDS.WIN, side: SIDES.HOME, line: null, odds: 80 },
  'handicap +3.5 at 6': { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: 3.5, odds: 6 },
  'over 10.5 at 150': { kind: OUTCOME_KINDS.OVER, side: null, line: 10.5, odds: 150 },
  'no draw at 1.02': { kind: OUTCOME_KINDS.NO_DRAW, side: null, line: null, odds: 1.02 },
};

describe('checkOutcome', () => {
  test.each([
    ['home win at 80', INELIGIBILITY_REASONS.ODDS],
    ['no draw at 1.02', INELIGIBILITY_REASONS.ODDS],
    ['handicap +3.5 at 6', INELIGIBILITY_REASONS.LINE],
    ['over 10.5 at 150', INELIGIBILITY_REASONS.ODDS],
    ['draw at 15', INELIGIBILITY_REASONS.CALIBRATION],
  ])('rejects %s', (name, reason) => {
    expect(checkOutcome(EXTREME_OUTCOMES[name])).toEqual({ isEligible: false, reason });
  });

  test.each([
    ['an integer handicap', { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: -1, odds: 2 }],
    ['a quarter handicap', { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME, line: -0.25, odds: 1.9 }],
    ['a total above 6.5', { kind: OUTCOME_KINDS.OVER, side: null, line: 7.5, odds: 9 }],
  ])('rejects %s', (name, outcome) => {
    expect(checkOutcome(outcome)).toEqual({ isEligible: false, reason: INELIGIBILITY_REASONS.LINE });
  });

  test('accepts every outcome of the four regular matches', () => {
    const outcomes = MATCHES.filter(match => match.id !== 'm5').flatMap(match =>
      match.markets.flatMap(market =>
        market.outcomes.map(outcome => parseSlipOutcome(toSlipSelection(match, market, outcome)))
      )
    );

    expect(outcomes.filter(outcome => !checkOutcome(outcome).isEligible)).toEqual([]);
  });
});

test.each(Object.keys(EXTREME_OUTCOMES))('caps the payout of a round forced on %s', name => {
  const outcome = EXTREME_OUTCOMES[name];
  const { payoutScale, startChance } = calibrateMatch(outcome);

  expect(payoutScale).toBeLessThanOrEqual(outcome.odds);
  expect(payoutScale * startChance).toBeLessThanOrEqual(1 - HOUSE_EDGE + 0.01);
});
