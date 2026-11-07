---
name: crash-verify
description: Run Crash Slip locally and check it in a browser — start the dev server, pick outcomes, play rounds, catch overlaps and stale state, test mobile width. Use after any UI or engine change, before a deploy, or when the user says "проверь", "прогони сценарии", "запусти и посмотри", "что-то накладывается".
---

# Verify Crash Slip in a browser

## Start

```bash
npm run dev    # http://localhost:5180, strict port
```

In the Claude desktop app, open it in the built-in browser pane (`preview_start` with a launch config whose command
is `npm --prefix <repo> run dev` and port 5180, or with `url: http://localhost:5180`). The live demo is
https://matlish00010.github.io/crash-slip/.

## Test hooks

| `data-test-id` | Element |
|---|---|
| `odd-<matchId>/<marketExternalId>/<outcomeExternalId>` | odds button, e.g. `odd-m1/18/12` = Red Lions – Blue Sharks, over 2.5 |
| `slip-remove` | clear the slip |
| `crash-empty` | empty state (no outcome in the slip) |
| `crash-place` / `crash-cash-out` | main button before / during a round |
| `crash-stage`, `crash-suspense`, `crash-event-banner`, `crash-result` | stage parts |

Matches: `m1` even (2.10 / 3.40 / 3.60), `m2` home favourite, `m3` away favourite with home +1.5, `m4` even and low
scoring with −0.5. Markets: `1` 1x2, `10` double chance, `16` handicap, `18` total.

Start a round from the console:

```js
document.querySelector('[data-test-id="odd-m1/1/1"]').click();
await new Promise(r => setTimeout(r, 300));
document.querySelector('[data-test-id=crash-place]').click();
```

Wait for a decision window (keep each script under ~40 s; split long waits into several calls):

```js
for (let i = 0; i < 400; i++) {
  await new Promise(r => setTimeout(r, 80));
  if (document.querySelector('[data-test-id=crash-suspense]')) break;
}
```

## Scenarios to run

1. Empty slip shows the empty state; clicking an odd shows the game with the right teams and outcome line.
2. One round per theme family: 1x2 (Push), X (Balance), 1X/X2 (Hold), 12 (No draw), handicap −/+ (Gap / Cushion),
   over (Rocket), under (Vault). Check the crash banner text and the red frame, or the win banner and confetti.
3. A decision window: the banner sits between the multiplier and the chart, the countdown bar drains, the button
   pulses; the outcome text appears after it.
4. Manual cash out mid-round: the marker and label on the chart, the dashed ghost line afterwards, `+payout` in the
   header at the end.
5. Auto cash out: chips at or above the outcome odds are disabled and never stay selected.
6. Change the slip during a round: the round keeps its outcome. After a round ends, click any odd: the old result
   is gone and the new outcome shows 0 : 0, an empty chart and its own odds line.
7. Mobile width (375 px): the slip goes above the feed, nothing wraps or overlaps.

## What to look for

- Nothing drawn or written on top of the multiplier, the chart curve or the axis labels.
- The `stake 1.00x` and `odds …x` labels do not touch each other.
- No stale score, odds line or result from a previous outcome.
- No console errors.
- After an HMR reload the canvas can draw garbage once; reload the page before judging a canvas bug.
