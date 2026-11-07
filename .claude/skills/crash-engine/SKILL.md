---
name: crash-engine
description: How the Crash Slip engine works and how to change it safely — odds calibration, the value table, crash and win rules per outcome kind, themes, decision windows (penalty, VAR, attack), and the tests that guard fairness. Use before touching src/crash/crash-engine.js, crash-outcomes.js, crash-themes.js or use-crash-round.js, when adding a market or outcome kind, tuning the pace or the odds, or when the user asks "how does the multiplier work", "почему икс упал", "добавь маркет", "поменяй правило краша".
---

# Crash engine

## The model in one paragraph

An outcome from the slip becomes a rule set (`crash-outcomes.js`). The engine builds a fake match whose goal rates
make the chance of winning the round equal `1 / odds` (`calibrateMatch`). A dynamic-programming table holds
`V(minute, home goals, away goals)` = the chance of winning the round from that state (`buildValueTable`). The
multiplier shown and paid is `V(now) / V(kick-off)`. Because `V` is a martingale, the expected payout is the stake
whatever moment the player cashes out, and a won round pays exactly `1 / V(kick-off)` = the odds.

## Rules per outcome kind

`lead` = own goals − opponent goals for the backed side.

| Kind (theme) | Crash during the match | Win at full time | Calibrated by |
|---|---|---|---|
| `win` — 1 / 2 (Push for the win) | `lead < 0` | `lead > 0` | team strength |
| `draw` — X (Balance) | `|home − away| ≥ 2` | level | total goals |
| `double_side` — 1X / X2 (Hold the line) | `lead < 0` | `lead ≥ 0` | team strength |
| `no_draw` — 12 (No draw) | never | not level | total goals |
| `handicap` −line (Build the gap) / +line (Keep the cushion) | `lead < min(0, −line)` | `lead + line > 0` | team strength |
| `over` (Rocket) | never; the goal over the line wins at once (`isInstantWin`) | total > line | total goals |
| `under` (Vault) | total > line | total < line | total goals |

The handicap line is stored from the backed side: the `hcp` specifier is from the home side, so the away outcome
negates it.

## Key numbers (`crash-engine.js`)

| Constant | Value | Meaning |
|---|---|---|
| `MATCH_DURATION_MS` | 26000 | 90 match minutes in real time, pauses excluded |
| `KICKOFF_DELAY_MS` | 1800 | 3-2-1 countdown |
| `SUSPENSE_MS` | 2200 | decision window; the clock is frozen |
| `TABLE_STEP_MINUTES` | 0.5 | value table time step; values are interpolated between steps |
| `MAX_GOALS` | 10 | score cap per side in the table |
| `DEFAULT_TOTAL_GOALS` | 2.7 | goals per match when strength is calibrated |
| `STRENGTH_RANGE` / `GOALS_RANGE` | 0.04–0.96 / 0.4–7 | binary search bounds |
| target chance | `1 / odds`, clamped to 0.03–0.97 | what calibration aims at |

Decision windows (`SUSPENSE_SETTINGS`): penalty 76 % goal, 12 % of goals; VAR 55 %, 18 %; attack 30 %, 30 %.
The rest of the goals come without a window. False alarms get the rate
`rate × share × (1 − goalChance) / goalChance`, so a window of a given type ends in a goal with exactly its
`goalChance`. During a window the price is `goalChance × V(after goal) + (1 − goalChance) × V(no goal)`; `isThreat`
is true when the goal would lower `V`.

## Round lifecycle

1. `createRound(outcome)` calibrates (≈50–100 ms) and pre-generates all events for 90 minutes.
2. `useCrashRound.start` publishes a countdown, then each animation frame calls `getRoundStateAt(round, elapsedMs)`,
   which replays events up to the elapsed time and returns `phase`, `minute`, `score`, `suspense`, `lastEvent`,
   `chance`, `multiplier`.
3. The phase becomes `crashed` on a breaking goal, `won` on an instant win or a winning full time, `lost` on a
   losing full time. A cashed-out round keeps running to its end as a dashed "what would have happened" line.
4. Auto cash out triggers when the multiplier reaches the target and pays the target (a jump over it pays the
   target, not the jump).

## How to change things

- **New market or outcome**: add its ids to `OUTCOME_IDS` and a line reader in `getOutcomeLine` if it has a
  specifier; add a kind to `RULES` with `isCrash`, `isWinAtFullTime`, optional `isInstantWin`, and `calibration`;
  map it to a theme in `getThemeId`; add texts in `crash-themes.js`; add the outcome to `src/data/matches.js`; add
  parse, calibration, rule and fairness tests.
- **New theme**: add a `THEME_IDS` entry, a `THEMES` entry (keep `glyph: '⚽'`; the owner wants a ball
  everywhere), a crash text, and a win text if it differs.
- **Pace**: change `MATCH_DURATION_MS` / `SUSPENSE_MS`; the math does not depend on them.
- **More or fewer decision windows**: change `shareOfGoals`; keep the sum below 1.
- **A house edge**: multiply the payout, not `V`; then the fairness test needs a new expected value.

## Invariants the tests guard (`npm test`)

- Calibration hits `1 / odds` for every demo outcome (2 decimals).
- The crash and win rules per theme on scripted events.
- A penalty freezes the clock and is priced between the two outcomes.
- Full time with a win pays the odds.
- Monte Carlo: cashing out at a fixed minute returns 0.9–1.1 of the stake on average.

Run `npm test` after every engine change, and check the change in a browser with the `crash-verify` skill.
