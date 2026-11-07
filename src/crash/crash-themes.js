import { THEME_IDS } from './crash-outcomes';

export const THEMES = {
  [THEME_IDS.PUSH]: { glyph: '⚽', lineColor: 'primary', gradientColor: 'promo' },
  [THEME_IDS.BALANCE]: { glyph: '⚽', lineColor: 'accent', gradientColor: 'primary' },
  [THEME_IDS.HOLD]: { glyph: '⚽', lineColor: 'primary', gradientColor: 'success' },
  [THEME_IDS.NO_DRAW]: { glyph: '⚽', lineColor: 'warn', gradientColor: 'promo' },
  [THEME_IDS.GAP]: { glyph: '⚽', lineColor: 'promo', gradientColor: 'warn' },
  [THEME_IDS.CUSHION]: { glyph: '⚽', lineColor: 'primary', gradientColor: 'accent' },
  [THEME_IDS.ROCKET]: { glyph: '⚽', lineColor: 'warn', gradientColor: 'error' },
  [THEME_IDS.VAULT]: { glyph: '⚽', lineColor: 'accent', gradientColor: 'success' },
};

const SUSPENSE_TEXTS = {
  penalty: team => `PENALTY · ${team}`,
  var: team => `VAR CHECK · ${team}`,
  attack: team => `DANGER · ${team}`,
};

const MISS_TEXTS = {
  penalty: 'SAVED!',
  var: 'VAR: NO GOAL',
  attack: 'MISSED!',
};

export const getSuspenseText = (type, team) => SUSPENSE_TEXTS[type](team);

export const getMissText = type => MISS_TEXTS[type];
