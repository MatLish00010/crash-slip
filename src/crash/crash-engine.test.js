import {
  calibrateMatch,
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
    'matches the chance implied by the odds for %s',
    (id, outcome) => {
      expect(calibrateMatch(outcome).startChance).toBeCloseTo(1 / outcome.odds, 2);
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
  test('crashes the win theme when the opponent takes the lead', () => {
    const round = createScriptedRound(findDemoOutcome('demo-home'), [
      { minute: 10, team: SIDES.AWAY, isGoal: true, suspense: null },
    ]);

    expect(getRoundStateAt(round, 5 * MS_PER_MINUTE).phase).toBe(ROUND_PHASES.RUNNING);
    expect(getRoundStateAt(round, 11 * MS_PER_MINUTE)).toMatchObject({ phase: ROUND_PHASES.CRASHED, multiplier: 0 });
  });

  test('keeps the hold theme alive after an equaliser and drops the multiplier', () => {
    const round = createScriptedRound(findDemoOutcome('demo-1x'), [
      { minute: 10, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 20, team: SIDES.AWAY, isGoal: true, suspense: null },
    ]);
    const leading = getRoundStateAt(round, 15 * MS_PER_MINUTE);
    const level = getRoundStateAt(round, 21 * MS_PER_MINUTE);

    expect(level.phase).toBe(ROUND_PHASES.RUNNING);
    expect(level.multiplier).toBeLessThan(leading.multiplier);
  });

  test('wins the rocket theme on the goal that passes the line', () => {
    const round = createScriptedRound(findDemoOutcome('demo-over'), [
      { minute: 5, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 6, team: SIDES.AWAY, isGoal: true, suspense: null },
      { minute: 7, team: SIDES.HOME, isGoal: true, suspense: null },
    ]);

    expect(getRoundStateAt(round, 8 * MS_PER_MINUTE)).toMatchObject({
      phase: ROUND_PHASES.WON,
      minute: 7,
      multiplier: Math.floor((1 / round.startChance) * 100) / 100,
    });
  });

  test('crashes the vault theme on the goal that breaks the line', () => {
    const round = createScriptedRound(findDemoOutcome('demo-under'), [
      { minute: 5, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 6, team: SIDES.HOME, isGoal: true, suspense: null },
      { minute: 7, team: SIDES.AWAY, isGoal: true, suspense: null },
    ]);

    expect(getRoundStateAt(round, 8 * MS_PER_MINUTE).phase).toBe(ROUND_PHASES.CRASHED);
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

    expect(getRoundStateAt(round, FINAL_MS)).toMatchObject({ phase: ROUND_PHASES.WON, minute: 90 });
    expect(getRoundStateAt(round, FINAL_MS).multiplier).toBeCloseTo(outcome.odds, 1);
  });

  test.each(['demo-home', 'demo-x2', 'demo-hcp-minus', 'demo-over', 'demo-under'])(
    'returns about the stake on average for %s whatever minute the player cashes out',
    id => {
      const calibration = calibrateMatch(findDemoOutcome(id));
      const rng = createSeededRng(11);
      const rounds = 4000;
      let returned = 0;

      for (let index = 0; index < rounds; index += 1) {
        const round = {
          ...calibration,
          outcome: findDemoOutcome(id),
          events: generateMatchEvents(calibration.rates, rng),
        };
        const cashOut = getRoundStateAt(round, 40 * MS_PER_MINUTE);
        const final = getRoundStateAt(round, FINAL_MS);

        returned += cashOut.phase === ROUND_PHASES.RUNNING && index % 2 === 0 ? cashOut.multiplier : final.multiplier;
      }

      expect(returned / rounds).toBeGreaterThan(0.9);
      expect(returned / rounds).toBeLessThan(1.1);
    }
  );
});

test('formats the match clock and floors the payout', () => {
  expect(getMatchClockMinute(11.4)).toBe(12);
  expect(getMatchClockMinute(95)).toBe(90);
  expect(getPayout(10, 2.345)).toBe(23.45);
});
