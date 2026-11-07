# Crash Slip

Live demo: https://matlish00010.github.io/crash-slip/

Pick a football outcome from the feed and play it in the bet slip as a fast fake match.

The match is calibrated to the outcome odds and always plays to full time. The multiplier is the live cash-out
price of the outcome: it falls when the score goes against the outcome, rises when it goes for it, and reaches the
full odds at the whistle if the outcome wins. Cash out at any moment to keep part or all of the stake, or hold to
the end for the full odds or nothing.

Penalties, VAR checks and dangerous attacks freeze the clock for two seconds, and the player can cash out before
they resolve.

The house keeps a 5 % edge: whatever moment the player cashes out, the average return is about 95 % of the stake.
Everything runs in the browser and no real money is involved.

## Run

```bash
npm install
npm run dev
npm test
```

## Deploy

```bash
npm run deploy
```

The script runs the tests, builds with the `/crash-slip/` base path and force-pushes `dist` to the `gh-pages` branch, which GitHub Pages serves at https://matlish00010.github.io/crash-slip/. It pushes through the GitHub CLI login (`gh auth login`).
