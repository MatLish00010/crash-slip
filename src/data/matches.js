const MARKETS = { ONE_X_TWO: 1, DOUBLE_CHANCE: 10, HANDICAP: 16, TOTAL: 18 };

const formatLine = value => (value > 0 ? `+${value}` : `${value}`);

function buildMarkets({ nameA, nameB, oneXTwo, doubleChance, handicap, total }) {
  return [
    {
      externalId: MARKETS.ONE_X_TWO,
      name: '1x2',
      specifier: '',
      outcomes: [
        { externalId: '1', name: nameA, short: '1', odds: oneXTwo[0] },
        { externalId: '2', name: 'Draw', short: 'X', odds: oneXTwo[1] },
        { externalId: '3', name: nameB, short: '2', odds: oneXTwo[2] },
      ],
    },
    {
      externalId: MARKETS.DOUBLE_CHANCE,
      name: 'Double chance',
      specifier: '',
      outcomes: [
        { externalId: '9', name: `${nameA} or draw`, short: '1X', odds: doubleChance[0] },
        { externalId: '10', name: `${nameA} or ${nameB}`, short: '12', odds: doubleChance[1] },
        { externalId: '11', name: `Draw or ${nameB}`, short: 'X2', odds: doubleChance[2] },
      ],
    },
    {
      externalId: MARKETS.HANDICAP,
      name: 'Handicap',
      specifier: `hcp=${handicap.line}`,
      outcomes: [
        {
          externalId: '1714',
          name: `${nameA} (${formatLine(handicap.line)})`,
          short: `H1 ${formatLine(handicap.line)}`,
          odds: handicap.odds[0],
        },
        {
          externalId: '1715',
          name: `${nameB} (${formatLine(-handicap.line)})`,
          short: `H2 ${formatLine(-handicap.line)}`,
          odds: handicap.odds[1],
        },
      ],
    },
    {
      externalId: MARKETS.TOTAL,
      name: 'Total',
      specifier: `total=${total.line}`,
      outcomes: [
        { externalId: '12', name: `over ${total.line}`, short: `O ${total.line}`, odds: total.odds[0] },
        { externalId: '13', name: `under ${total.line}`, short: `U ${total.line}`, odds: total.odds[1] },
      ],
    },
  ];
}

const createMatch = ({ id, league, kickOff, nameA, nameB, colorsA, colorsB, ...odds }) => ({
  id,
  league,
  kickOff,
  nameA,
  nameB,
  colorsA,
  colorsB,
  markets: buildMarkets({ nameA, nameB, ...odds }),
});

export const MATCHES = [
  createMatch({
    id: 'm1',
    league: 'Premier Cup',
    kickOff: 'Today 18:30',
    nameA: 'Red Lions',
    nameB: 'Blue Sharks',
    colorsA: ['#d7263d', '#8a1022'],
    colorsB: ['#1b6fd8', '#0d3a73'],
    oneXTwo: [2.1, 3.4, 3.6],
    doubleChance: [1.3, 1.33, 1.75],
    handicap: { line: -1.5, odds: [4.2, 1.22] },
    total: { line: 2.5, odds: [1.95, 1.85] },
  }),
  createMatch({
    id: 'm2',
    league: 'Premier Cup',
    kickOff: 'Today 20:45',
    nameA: 'Northside FC',
    nameB: 'Harbor United',
    colorsA: ['#f2b705', '#1f1f1f'],
    colorsB: ['#e8e8e8', '#2a9d8f'],
    oneXTwo: [1.45, 4.5, 7],
    doubleChance: [1.1, 1.25, 2.7],
    handicap: { line: -1.5, odds: [2.3, 1.6] },
    total: { line: 2.5, odds: [1.7, 2.1] },
  }),
  createMatch({
    id: 'm3',
    league: 'Continental League',
    kickOff: 'Tomorrow 19:00',
    nameA: 'Iron Wolves',
    nameB: 'Golden Eagles',
    colorsA: ['#6c757d', '#212529'],
    colorsB: ['#e9c46a', '#a07c16'],
    oneXTwo: [4.8, 3.9, 1.7],
    doubleChance: [2.15, 1.25, 1.2],
    handicap: { line: 1.5, odds: [1.45, 2.6] },
    total: { line: 2.5, odds: [2.05, 1.75] },
  }),
  createMatch({
    id: 'm4',
    league: 'Continental League',
    kickOff: 'Tomorrow 21:00',
    nameA: 'Atletico Sol',
    nameB: 'Real Luna',
    colorsA: ['#f4a261', '#c1121f'],
    colorsB: ['#cdb4db', '#3d348b'],
    oneXTwo: [2.7, 2.9, 2.85],
    doubleChance: [1.4, 1.38, 1.45],
    handicap: { line: -0.5, odds: [2.7, 1.45] },
    total: { line: 2.5, odds: [2.4, 1.55] },
  }),
  createMatch({
    id: 'm5',
    league: 'Cup, first round',
    kickOff: 'Sunday 16:00',
    nameA: 'Comet Town',
    nameB: 'Galaxy FC',
    colorsA: ['#8ecae6', '#219ebc'],
    colorsB: ['#7b2cbf', '#240046'],
    oneXTwo: [34, 12, 1.06],
    doubleChance: [8.5, 1.03, 1.01],
    handicap: { line: 2.5, odds: [1.9, 1.9] },
    total: { line: 3.5, odds: [1.7, 2.1] },
  }),
];

const ODDS_SUBUNITS = 1000;

export const toSlipSelection = (match, market, outcome) => ({
  id: `${match.id}/${market.externalId}/${outcome.externalId}`,
  matchId: match.id,
  nameA: match.nameA,
  nameB: match.nameB,
  colorsA: match.colorsA,
  colorsB: match.colorsB,
  marketExternalId: market.externalId,
  outcomeExternalId: outcome.externalId,
  specifier: market.specifier,
  marketName: market.name,
  outcomeName: outcome.name,
  odds: Math.round(outcome.odds * ODDS_SUBUNITS),
});
