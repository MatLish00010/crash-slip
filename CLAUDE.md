# Crash Slip

A demo of a product idea: the player picks a football outcome in the feed, it goes to the bet slip, and the slip
plays that outcome as a crash game. A fake match runs for about 26 seconds; a multiplier moves with the match; the
player cashes out at any moment or loses when the outcome breaks.

- Live demo: https://matlish00010.github.io/crash-slip/
- Repository: https://github.com/MatLish00010/crash-slip (public, account `MatLish00010`)
- Stack: Vite 5 + React 18 (plain JS, no TypeScript), Sass, Vitest. No backend, no real money.

## Where the idea comes from

The prototype was first built inside the sportsbook monorepo `~/projects/constructor` (branch `simulation-crash`,
worktree `.claude/worktrees/simulation-crash`, code in `packages/demo/src/components/crash-game/`). There the
crash is a third bet slip tab next to "Real bets" and "Simulations". This repo is a standalone copy with the
sportsbook dependencies removed (`react-intl`, Redux, sportsbook `Button` / `TeamLogo`). The two copies are not
synced: a change made here is not in constructor, and the reverse.

## Read first

| Need | Go to |
|---|---|
| Change the math, the rules or a theme | `.claude/skills/crash-engine/SKILL.md` |
| Run the app and check it in a browser | `.claude/skills/crash-verify/SKILL.md` |
| Publish the demo | `.claude/skills/crash-deploy/SKILL.md` |

## Commands

```bash
npm install
npm run dev      # http://localhost:5180 (strict port)
npm test         # Vitest, engine tests
npm run build    # base path /crash-slip/ (GitHub Pages)
npm run deploy   # tests + build + force-push dist to gh-pages
```

## File map

| File | Role |
|---|---|
| `src/app.jsx` | Page: match feed on the left, bet slip with the crash on the right; holds the one selected outcome |
| `src/data/matches.js` | Four fictional matches with 1x2, double chance, handicap and total markets; `toSlipSelection` builds a sportsbook-shaped selection |
| `src/feed/match-card.jsx` | Match card with odds buttons; a click selects or clears the outcome |
| `src/crash/crash-outcomes.js` | Parses a selection into an outcome descriptor; crash and win rules per outcome kind; theme ids |
| `src/crash/crash-engine.js` | Calibration, value table, match events, round state at a given time |
| `src/crash/use-crash-round.js` | rAF game loop, countdown, cash out, auto cash out, multiplier history |
| `src/crash/crash-stage.jsx` + `crash-canvas.js` | Header (chance, clock, multiplier, event slot) and the canvas chart with particles |
| `src/crash/crash-game.jsx` | Bet slip body: teams and score, outcome line, stage, stake, auto cash out, Place / Cash out |
| `src/crash/crash-themes.js` | Glyph and colours per theme; crash, win, suspense and miss texts |
| `src/crash/crash-engine.test.js` | Parsing, calibration, rules, suspense pricing, fairness (Monte Carlo) |

## Selection contract

The engine reads sportsbook-shaped selections, so the code can move back to constructor unchanged:
`marketExternalId` (1, 10, 16, 18), `outcomeExternalId` (Betradar ids: `1/2/3`, `9/10/11`, `1714/1715`, `12/13`),
`specifier` (`hcp=-1.5` from the home side, `total=2.5`), `odds` as an integer ×1000 (`1950` = 1.95), plus
`nameA`, `nameB`, `marketName`, `outcomeName`. Any other market returns `null` from `parseSlipOutcome`.

## Product decisions

These were agreed with the product owner; do not undo them without asking.

- **The outcome comes from the bet slip only.** No outcome picker inside the crash, the same as Simulations. A
  running round keeps its outcome even if the slip changes. A finished round stays on screen only until the player
  clicks an odd: any new pick (even the same outcome again) clears the old result and shows a fresh 0 : 0 round.
- **Minimal UI.** Keep: teams with score, the outcome line with odds, the stage, stake chips, auto cash out chips,
  Place / Cash out. Removed on purpose: demo balance, outcome chips, theme card (title, rule, max odds),
  15'/30'/… checkpoint row, meter ("Lead +1"), round history. The canvas still marks 15'…FT on its axis.
- **A ball everywhere.** Every theme draws ⚽ and it spins in flight; 💥 on a crash.
- **Nothing overlaps the chart.** The multiplier, clock, chance and event banners live in a header above the
  canvas, not on top of it. The event slot has a fixed height, so the layout does not jump.
- **The multiplier is the live price of the outcome**, `chance now / chance at kick-off`. It starts at 1.00x, can
  fall below 1 (cash out returns part of the stake: 1 $ × 0.5 = 0.50 $), and a won round pays the outcome odds.
- **The crash event is a clear football event** (a goal that breaks the rule, or the final whistle), never a
  random "the plane flew away".
- **Decision windows.** Penalties, VAR checks and dangerous attacks freeze the clock for 2.2 s; the multiplier
  during the window is the fair price of the two resolutions, and the player can cash out before it resolves.

## Known limits and open ideas

- Return to player is 100 %: the only margin is the one inside the bookmaker odds. A house edge belongs on the
  backend as a payout factor.
- The round is generated in the browser. In production the backend must own the round and reveal events as they
  happen, and accept a cash out by server time; otherwise DevTools shows the crash minute.
- Integer and quarter handicaps (−1, −0.25) have no push: a level result on the handicap loses.
- Not built yet: chains of matches (a won round carries its multiplier into the next match), a house edge.

## Code rules

- Named exports only; kebab-case file names; components wrapped in `memo`.
- No comments unless a fact lives outside the code.
- CSS classes: BEM-like with `sb-` (crash parts, shared with constructor) and `cs-` (page shell) prefixes; state
  classes without prefix (`isActive`, `isCrashed`). Colours only through the CSS variables in `src/styles.css`.
- Every engine change keeps `npm test` green; add a test for a new rule or market.
- Check every UI change in a browser before calling it done (see `crash-verify`).

## Working with the owner

- Chat answers in Russian, short and plain. Code, docs and commit messages in English.
- Commit only when asked; push and deploy only when asked or when the request clearly includes publishing.
