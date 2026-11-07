# Crash Slip

Live demo: https://matlish00010.github.io/crash-slip/

Pick a football outcome from the feed and play it in the bet slip as a crash game.

The fake match is calibrated to the outcome odds, so the multiplier is the live price of the outcome: a round that wins pays the odds, and you can cash out at any moment. Each outcome kind has its own crash rule:

| Outcome | Theme | Crash |
|---|---|---|
| 1 / 2 | Push for the win | The opponent takes the lead; a draw at full time loses |
| X | Balance | A two-goal gap |
| 1X / X2 | Hold the line | The opponent takes the lead |
| 12 | No draw | A draw at full time |
| Handicap −X | Build the gap | The opponent takes the lead; the gap is short at full time |
| Handicap +X | Keep the cushion | The cushion is gone |
| Over | Rocket | Not enough goals at full time; the goal over the line wins at once |
| Under | Vault | The goal over the line |

Penalties, VAR checks and dangerous attacks freeze the clock for two seconds, and the player can cash out before they resolve.

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
