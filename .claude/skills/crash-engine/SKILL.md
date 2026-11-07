---
name: crash-engine
description: How the Crash Slip engine works and how to change it safely — odds calibration with the house edge, the value table, the full-time win rule per outcome kind, decision windows (penalty, VAR, attack), and the tests that guard the house edge. Use before touching src/crash/crash-engine.js, crash-outcomes.js, crash-themes.js or use-crash-round.js, when adding a market or outcome kind, tuning the pace or the odds, or when the user asks "how does the multiplier work", "почему икс упал", "добавь маркет", "поменяй правило", "почему игрок в плюсе".
---

# Crash engine

## The model in one paragraph

An outcome from the slip becomes a full-time win rule (`crash-outcomes.js`). The engine builds a fake match whose
goal rates give the outcome a chance of `(1 − HOUSE_EDGE) / odds` (`calibrateMatch`). A dynamic-programming table
holds `V(minute, home goals, away goals)` = the chance that the outcome wins at full time from that state
(`buildValueTable`). The multiplier shown and paid is `odds × V(now)`. `V` is a martingale, so every cash-out
strategy returns `odds × V(kick-off) = 1 − HOUSE_EDGE` of the stake on average; a round that wins at the whistle
pays exactly the odds. The match always runs to 90': no goal ends the round early.

## Win rule per outcome kind

`lead` = own goals − opponent goals for the backed side. The theme only picks the chart colours.

| Kind (theme id) | Wins at full time when | Calibrated by |
|---|---|---|
| `win` — 1 / 2 (`push`) | `lead > 0` | team strength |
| `draw` — X (`balance`) | level | total goals |
| `double_side` — 1X / X2 (`hold`) | `lead ≥ 0` | team strength |
| `no_draw` — 12 (`no_draw`) | not level | total goals |
| `handicap` −line (`gap`) / +line (`cushion`) | `lead + line > 0` | team strength |
| `over` (`rocket`) | total > line; after the goal over the line `V` = 1, the price locks at the odds | total goals |
| `under` (`vault`) | total < line; after the goal over the line `V` = 0, the price locks at 0 | total goals |

The handicap line is stored from the backed side: the `hcp` specifier is from the home side, so the away outcome
negates it. Integer and quarter lines have no push.

## Key numbers (`crash-engine.js`)

| Constant | Value | Meaning |
|---|---|---|
| `MATCH_DURATION_MS` | 26000 | 90 match minutes in real time, pauses excluded |
| `KICKOFF_DELAY_MS` | 1800 | 3-2-1 countdown |
| `SUSPENSE_MS` | 2200 | decision window; the clock is frozen |
| `TABLE_STEP_MINUTES` | 0.5 | value table time step; values are interpolated between steps |
| `MAX_GOALS` | 10 | score cap per side in the table |
| `HOUSE_EDGE` | 0.05 | the average share of the stake the house keeps |
| `DEFAULT_TOTAL_GOALS` | 2.7 | goals per match when strength is calibrated |
| `STRENGTH_RANGE` / `GOALS_RANGE` | 0.04–0.96 / 0.4–7 | binary search bounds |
| target chance | `(1 − HOUSE_EDGE) / odds`, clamped to 0.02–0.95 | what calibration aims at |

Decision windows (`SUSPENSE_SETTINGS`): penalty 76 % goal, 12 % of goals; VAR 55 %, 18 %; attack 30 %, 30 %.
The rest of the goals come without a window. False alarms get the rate
`rate × share × (1 − goalChance) / goalChance`, so a window of a given type ends in a goal with exactly its
`goalChance`. During a window the price is `goalChance × V(after goal) + (1 − goalChance) × V(no goal)`; `isThreat`
is true when the goal would lower `V`.

## Round lifecycle

1. `createRound(outcome)` calibrates (≈50–100 ms) and pre-generates all events for 90 minutes.
2. `useCrashRound.start` publishes a countdown, then each animation frame calls `getRoundStateAt(round, elapsedMs)`,
   which replays events up to the elapsed time and returns `phase`, `minute`, `score`, `suspense`, `lastEvent`,
   `chance`, `multiplier`. The first live frame shows about `1 − HOUSE_EDGE` (0.95x).
3. The phase stays `running` until 90', then becomes `won` (multiplier = odds) or `lost` (0). A cashed-out round
   keeps running to the end as a dashed "what would have happened" line.
4. Auto cash out triggers when the multiplier reaches the target and pays the target (a jump over it pays the
   target, not the jump).

## How to change things

- **New market or outcome**: add its ids to `OUTCOME_IDS` and a line reader in `getOutcomeLine` if it has a
  specifier; add a kind to `RULES` with `isWinAtFullTime` and `calibration`; map it to a theme in `getThemeId`; add
  the outcome to `src/data/matches.js`; add parse, calibration, price and house-edge tests.
- **New theme**: add a `THEME_IDS` entry and a `THEMES` entry with its colours (keep `glyph: '⚽'`; the owner wants
  a ball everywhere).
- **Pace**: change `MATCH_DURATION_MS` / `SUSPENSE_MS`; the math does not depend on them.
- **More or fewer decision windows**: change `shareOfGoals`; keep the sum below 1.
- **The house edge**: change `HOUSE_EDGE`. Never pay more than `odds × V`, and never add a rule that ends the
  round early in the player's favour; the house-edge tests catch both.

## Invariants the tests guard (`npm test`)

- Calibration sets the start chance to `(1 − HOUSE_EDGE) / odds` for every demo outcome.
- A round opens at about 0.95x; an opponent goal lowers the multiplier but does not end the round; behind < level
  < 1 < ahead.
- Over locks at the odds and under at 0 after the goal over the line, and both still play to full time.
- A penalty freezes the clock and is priced between the two outcomes.
- Full time with a win pays exactly the odds.
- Monte Carlo, five outcomes × three strategies (hold, cash out at 40', cash out at the first multiplier above 1.1):
  the average return is between 0.88 and 1.0 of the stake.

Run `npm test` after every engine change, and check the change in a browser with the `crash-verify` skill.
