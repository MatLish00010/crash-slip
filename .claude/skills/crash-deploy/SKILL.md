---
name: crash-deploy
description: Publish Crash Slip to GitHub Pages and push the code — the gh-pages deploy script, the GitHub account and credential quirks on this machine, and how to confirm the new build is live. Use when the user asks to deploy, publish, "залей", "задеплой", "обнови демку", or to push commits of this repo.
---

# Deploy Crash Slip

## Where things live

- Code: https://github.com/MatLish00010/crash-slip, branch `main`.
- Demo: https://matlish00010.github.io/crash-slip/, served by GitHub Pages from the `gh-pages` branch, path `/`.
- The production build uses the base path `/crash-slip/` (`vite.config.js`); `npm run dev` serves from `/`.

## Deploy

```bash
npm run deploy
```

`scripts/deploy.sh` runs the tests, builds, adds `.nojekyll`, and force-pushes `dist` as a one-commit `gh-pages`
branch. It deploys the working tree, so commit first if `main` should match the demo.

## Account and credentials on this machine

- `gh` has two github.com accounts; the repo belongs to `MatLish00010`, which must be the active one
  (`gh auth status`, `gh auth switch -u MatLish00010`).
- The SSH key on this machine authenticates as the other account (`MatsveiLishai`), so the remote is HTTPS and
  pushes go through the gh token:

  ```bash
  git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
  ```

- The gh token has no `workflow` scope, so GitHub rejects files under `.github/workflows`. That is why there is no
  GitHub Actions deploy. To switch to auto-deploy on push, the owner runs
  `gh auth refresh -h github.com -u MatLish00010 -s workflow` (interactive), then a Pages workflow can be added.

## Confirm the new build is live

Pages takes about a minute. Compare the asset name in `dist/index.html` with the live page:

```bash
python3 - <<'EOF'
import re, time, urllib.request
local = re.search(r'assets/index-[^"]+\.js', open('dist/index.html').read()).group(0)
for i in range(60):
    html = urllib.request.urlopen('https://matlish00010.github.io/crash-slip/?t=%d' % i).read().decode()
    if local in html:
        print('live:', local); break
    time.sleep(5)
EOF
```

Then open the live URL in a browser and play one round (see `crash-verify`). A browser may keep the old build
until a hard reload.
