export const SIDES = { HOME: 'home', AWAY: 'away' };

export const OUTCOME_KINDS = {
  WIN: 'win',
  DRAW: 'draw',
  DOUBLE_SIDE: 'double_side',
  NO_DRAW: 'no_draw',
  HANDICAP: 'handicap',
  OVER: 'over',
  UNDER: 'under',
};

export const CALIBRATION = { STRENGTH: 'strength', GOALS: 'goals' };

const ODDS_SUBUNITS = 1000;

const MARKETS = { ONE_X_TWO: '1', DOUBLE_CHANCE: '10', HANDICAP: '16', TOTAL: '18' };

const OUTCOME_IDS = {
  [MARKETS.ONE_X_TWO]: {
    1: { kind: OUTCOME_KINDS.WIN, side: SIDES.HOME },
    2: { kind: OUTCOME_KINDS.DRAW, side: null },
    3: { kind: OUTCOME_KINDS.WIN, side: SIDES.AWAY },
  },
  [MARKETS.DOUBLE_CHANCE]: {
    9: { kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.HOME },
    10: { kind: OUTCOME_KINDS.NO_DRAW, side: null },
    11: { kind: OUTCOME_KINDS.DOUBLE_SIDE, side: SIDES.AWAY },
  },
  [MARKETS.HANDICAP]: {
    1714: { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.HOME },
    1715: { kind: OUTCOME_KINDS.HANDICAP, side: SIDES.AWAY },
  },
  [MARKETS.TOTAL]: {
    12: { kind: OUTCOME_KINDS.OVER, side: null },
    13: { kind: OUTCOME_KINDS.UNDER, side: null },
  },
};

const readSpecifier = (specifier, key) => {
  const match = new RegExp(`${key}=(-?[\\d.]+)`).exec(specifier ?? '');

  return match ? Number(match[1]) : null;
};

function getOutcomeLine(kind, side, specifier) {
  if (kind === OUTCOME_KINDS.HANDICAP) {
    const homeLine = readSpecifier(specifier, 'hcp');

    if (homeLine === null) return null;

    return side === SIDES.HOME ? homeLine : -homeLine;
  }

  if (kind === OUTCOME_KINDS.OVER || kind === OUTCOME_KINDS.UNDER) return readSpecifier(specifier, 'total');

  return null;
}

export function parseSlipOutcome(selection) {
  if (!selection) return null;

  const descriptor = OUTCOME_IDS[String(selection.marketExternalId)]?.[String(selection.outcomeExternalId)];

  if (!descriptor) return null;

  const line = getOutcomeLine(descriptor.kind, descriptor.side, selection.specifier);
  const needsLine = [OUTCOME_KINDS.HANDICAP, OUTCOME_KINDS.OVER, OUTCOME_KINDS.UNDER].includes(descriptor.kind);

  if (needsLine && line === null) return null;

  return {
    ...descriptor,
    line,
    odds: (selection.acceptedOdds ?? selection.odds) / ODDS_SUBUNITS,
    marketName: selection.marketName,
    outcomeName: selection.outcomeName,
    id: `slip-${selection.id}`,
  };
}

const getLead = (outcome, home, away) => (outcome.side === SIDES.AWAY ? away - home : home - away);

const RULES = {
  [OUTCOME_KINDS.WIN]: {
    isWinAtFullTime: (outcome, home, away) => getLead(outcome, home, away) > 0,
    calibration: CALIBRATION.STRENGTH,
  },
  [OUTCOME_KINDS.DRAW]: {
    isWinAtFullTime: (outcome, home, away) => home === away,
    calibration: CALIBRATION.GOALS,
  },
  [OUTCOME_KINDS.DOUBLE_SIDE]: {
    isWinAtFullTime: (outcome, home, away) => getLead(outcome, home, away) >= 0,
    calibration: CALIBRATION.STRENGTH,
  },
  [OUTCOME_KINDS.NO_DRAW]: {
    isWinAtFullTime: (outcome, home, away) => home !== away,
    calibration: CALIBRATION.GOALS,
  },
  [OUTCOME_KINDS.HANDICAP]: {
    isWinAtFullTime: (outcome, home, away) => getLead(outcome, home, away) + outcome.line > 0,
    calibration: CALIBRATION.STRENGTH,
  },
  [OUTCOME_KINDS.OVER]: {
    isWinAtFullTime: (outcome, home, away) => home + away > outcome.line,
    calibration: CALIBRATION.GOALS,
  },
  [OUTCOME_KINDS.UNDER]: {
    isWinAtFullTime: (outcome, home, away) => home + away < outcome.line,
    calibration: CALIBRATION.GOALS,
  },
};

export const getRules = outcome => RULES[outcome.kind];

export const THEME_IDS = {
  PUSH: 'push',
  BALANCE: 'balance',
  HOLD: 'hold',
  NO_DRAW: 'no_draw',
  GAP: 'gap',
  CUSHION: 'cushion',
  ROCKET: 'rocket',
  VAULT: 'vault',
};

export function getThemeId(outcome) {
  switch (outcome.kind) {
    case OUTCOME_KINDS.WIN:
      return THEME_IDS.PUSH;
    case OUTCOME_KINDS.DRAW:
      return THEME_IDS.BALANCE;
    case OUTCOME_KINDS.DOUBLE_SIDE:
      return THEME_IDS.HOLD;
    case OUTCOME_KINDS.NO_DRAW:
      return THEME_IDS.NO_DRAW;
    case OUTCOME_KINDS.HANDICAP:
      return outcome.line < 0 ? THEME_IDS.GAP : THEME_IDS.CUSHION;
    case OUTCOME_KINDS.OVER:
      return THEME_IDS.ROCKET;
    default:
      return THEME_IDS.VAULT;
  }
}
