---
name: crash-engine
description: How the Crash Slip engine works and how to change it safely — odds calibration with the house edge, the value table, the full-time win rule per outcome kind, decision windows (penalty, VAR, attack), the payout cap and outcome eligibility, the exploit audit and what production must add. Use before touching src/crash/crash-engine.js, crash-outcomes.js, crash-themes.js or use-crash-round.js, when adding a market or outcome kind, tuning the pace, the odds or the limits, or when the user asks "how does the multiplier work", "почему икс упал", "добавь маркет", "поменяй правило", "почему игрок в плюсе", "где игрок может нас обмануть", "проверь математику на дыры".
---

# Crash engine

## The model in one paragraph

An outcome from the slip becomes a full-time win rule (`crash-outcomes.js`). The engine builds a fake match whose
goal rates give the outcome a chance of `(1 − HOUSE_EDGE) / odds` (`calibrateMatch`). A dynamic-programming table
holds `V(minute, home goals, away goals)` = the chance that the outcome wins at full time from that state
(`buildValueTable`). The multiplier shown and paid is `payoutScale × V(now)`, where
`payoutScale = min(odds, ceil₂((1 − HOUSE_EDGE) / V(kick-off)))`. When calibration hits its target the scale equals
the odds, so a round won at the whistle pays exactly the odds. `V` is a martingale, so every cash-out strategy
returns `payoutScale × V(kick-off) ≤ 1 − HOUSE_EDGE` of the stake on average. The match always runs to 90': no goal
ends the round early.

## Win rule per outcome kind

`lead` = own goals − opponent goals for the backed side. The theme only picks the chart colours.

| Kind (theme id) | Wins at full time when | Calibrated by |
|---|---|---|
| `win` — 1 / 2 (`push`) | `lead > 0` | team strength |
| `draw` — X (`balance`) | level | total goals |
| `double_side` — 1X / X2 (`hold`) | `lead ≥ 0` | team strength |
| `no_draw` — 12 (`no_draw`) | not level | total goals |
| `handicap` −line (`gap`) / +line (`cushion`) | `lead + line > 0` | team strength |
| `over` (`rocket`) | total > line; after the goal over the line `V` = 1, the price locks at the cap | total goals |
| `under` (`vault`) | total < line; after the goal over the line `V` = 0, the price locks at 0 | total goals |

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
| `HOUSE_EDGE` | 0.05 | the average share of the stake the house keeps |
| `DEFAULT_TOTAL_GOALS` | 2.7 | goals per match when strength is calibrated |
| `STRENGTH_RANGE` / `GOALS_RANGE` | 0.04–0.96 / 0.4–7 | binary search bounds |
| target chance | `(1 − HOUSE_EDGE) / odds`, clamped to 0.02–0.95 | what calibration aims at |
| `ODDS_RANGE` | 1.05–30 | odds a crash accepts |
| `MAX_HANDICAP_LINE` / `MAX_TOTAL_LINE` | 2.5 / 6.5 | largest line a crash accepts; half lines only |
| `CALIBRATION_TOLERANCE` | 0.02 | largest relative miss of the start chance before an outcome is refused |

Decision windows (`SUSPENSE_SETTINGS`): penalty 76 % goal, 12 % of goals; VAR 55 %, 18 %; attack 30 %, 30 %.
The rest of the goals come without a window. False alarms get the rate
`rate × share × (1 − goalChance) / goalChance`, so a window of a given type ends in a goal with exactly its
`goalChance`, and the price stays a martingale across window openings. During a window the price is
`goalChance × V(after goal) + (1 − goalChance) × V(no goal)`; `isThreat` is true when the goal would lower `V`.

## Outcome eligibility (`checkOutcome`)

The bet slip shows "Not available as a crash" instead of the game when any check fails:

| Reason | Fails when |
|---|---|
| `odds` | the odds are outside 1.05–30 |
| `line` | the line is not a half line (−1, −0.25 have no push), the handicap is beyond ±2.5, or the total is above 6.5 |
| `calibration` | the calibrated start chance misses `(1 − HOUSE_EDGE) / odds` by more than 2 % — the fake match cannot reproduce the odds (a draw at 12, for example) |

Calibration results are cached per `kind|side|line|odds`, so the check and the round share one calibration.

## Round lifecycle

1. `createRound(outcome)` calibrates (cached; ≈50–100 ms the first time) and pre-generates all events for 90
   minutes.
2. `useCrashRound.start` publishes a countdown, then each animation frame calls `getRoundStateAt(round, elapsedMs)`,
   which replays events up to the elapsed time and returns `phase`, `minute`, `score`, `suspense`, `lastEvent`,
   `chance`, `multiplier`. The first live frame shows about `1 − HOUSE_EDGE` (0.95x).
3. The phase stays `running` until 90', then becomes `won` (multiplier = `payoutScale`) or `lost` (0). A
   cashed-out round keeps running to the end as a dashed "what would have happened" line.
4. Cash out pays the multiplier of the last rendered frame. Auto cash out triggers when the multiplier reaches the
   target and pays the target (a jump over it pays the target, not the jump).

## Exploit audit

Run `npm run audit` (`ROUNDS=…` to change the sample, default 1500) after any change to the math. It plays six
strategies on regular and forced extreme outcomes and prints the average return per 1 staked ± standard error;
`HOLE` marks a cell that stays at or above 1 after subtracting two standard errors. The long shots are noisy: one
47x win moves an 800-round mean by about 6 %.

Audit of 2026-11-07, before and after the fixes:

| Finding | Before | Fix |
|---|---|---|
| Normal odds, any cash-out rule (hold, cash at a threat or chance window, at 1.2x, after a good goal, at 85' in profit) | 0.91–0.98, no hole: `V` is a martingale and windows are priced fairly | none needed |
| Calibration cannot reach the odds: draw at 15 | 2.30 | payout cap → 0.95 (pays 6.20x, not 15x); refused by `calibration` |
| Long shot past the 2 % chance clamp: home win at 80 | 1.60 | payout cap → 0.93 (pays 47.50x); refused by `odds` |
| Mispriced line the model cannot reach: handicap +3.5 at 6 | 4.52 | payout cap → 0.99 (pays 1.27x); refused by `line` |
| Total above the 10-goal table cap: over 10.5 at 150 | 3.00 | refused by `odds` and `line`; lines up to 6.5 are not affected by the cap |
| Odds below what the model can reach: 12 at 1.02 | 0.86 (player overcharged) | refused by `odds` |

What is not a hole, and why:

- Knowing the real match does not help: the fake match depends only on the odds, so value betting against the
  bookmaker changes nothing. Boosted or stale odds are priced at the same 95 %.
- Floor rounding of the multiplier and paying the auto cash-out target (not the jump) only favour the house.
- Linear interpolation of `V` between table steps moves prices by well under 0.1 %, far below the 5 % edge.

## What production must add

The demo generates the whole round in the browser; that is a total exploit outside a demo.

- **Server-owned round.** Generate events on the server with a cryptographic RNG and a fresh seed per bet; never
  send future events. Today `roundRef.current.events` holds all 90 minutes and React DevTools shows them.
- **Server-time cash out.** Accept a cash out at the server's state when the request arrives; reject it if a
  window has already resolved on the server, however early the client claims to have sent it.
- **No void on disconnect.** A dropped connection settles by the rules at 90'; voiding a losing round is a free
  option for the player.
- **Limits.** A maximum win per round and stake limits, like ordinary sportsbook bets; at 30x one big win hurts the
  cash flow even with a positive edge.
- **Eligibility on the server.** Run `checkOutcome` server-side with the odds the server accepts, not the ones the
  client sends.

## How to change things

- **New market or outcome**: add its ids to `OUTCOME_IDS` and a line reader in `getOutcomeLine` if it has a
  specifier; add a kind to `RULES` with `isWinAtFullTime` and `calibration`; map it to a theme in `getThemeId`; add
  the outcome to `src/data/matches.js`; add parse, calibration, price, eligibility and house-edge tests; run the
  audit.
- **New theme**: add a `THEME_IDS` entry and a `THEMES` entry with its colours (keep `glyph: '⚽'`; the owner wants
  a ball everywhere).
- **Pace**: change `MATCH_DURATION_MS` / `SUSPENSE_MS`; the math does not depend on them.
- **More or fewer decision windows**: change `shareOfGoals`; keep the sum below 1.
- **The house edge or the limits**: change `HOUSE_EDGE`, `ODDS_RANGE`, the line limits or the tolerance, then run
  the tests and the audit. Never pay more than `payoutScale × V`, never let `payoutScale` exceed the odds, and never
  add a rule that ends the round early in the player's favour.
- **Integer or quarter handicaps**: they need a push (refund) in `isWinAtFullTime` and in the table before the
  `line` check may accept them.

## Invariants the tests guard (`npm test`)

- Calibration sets the start chance to `(1 − HOUSE_EDGE) / odds` for every demo outcome.
- A round opens at about 0.95x; an opponent goal lowers the multiplier but does not end the round; behind < level
  < 1 < ahead.
- Over locks at the odds and under at 0 after the goal over the line, and both still play to full time.
- A penalty freezes the clock and is priced between the two outcomes.
- Full time with a win pays exactly the odds.
- Monte Carlo, five outcomes × three strategies (hold, cash out at 40', cash out at the first multiplier above 1.1):
  the average return is between 0.88 and 1.0 of the stake.
- `checkOutcome` refuses the extreme cases with the right reason, refuses integer, quarter and oversized lines, and
  accepts every outcome of matches m1–m4.
- For forced extreme outcomes `payoutScale ≤ odds` and `payoutScale × startChance ≤ 1 − HOUSE_EDGE` (+0.01).

Run `npm test` after every engine change, `npm run audit` after every change to the math, and check the change in
a browser with the `crash-verify` skill.
