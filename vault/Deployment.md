---
tags: [deployment]
---
# Deployment

- **Hosting:** GitHub Pages, `main` branch root, repository `Redrooster2508/wosomatchday`.
- **Pushing:** HTTPS with the access token saved in git's credential store. SSH is set up locally, but the key isn't linked to the GitHub account.
- **Self-refresh:** each page fetches `version.json` (bypassing the cache) and, if the build number is newer than its own, refreshes once. Release steps: raise `?v=`, the number in the version-check script, and `version.json`, all to the same value.
- **Caching:** Pages sends `max-age=600`. CSS and JS links carry `?v=N`, raised whenever those files change, so visitors don't see stale styles. This caused the overflow report in [[Log/2026-11-06]].
- **Workflows:** the token lacks the `workflow` scope, so the user added `.github/workflows/players.yml` through GitHub's web editor (2026-11-06). It runs every three hours (`17 */3 * * *`) and on demand from the Actions tab, and commits as `github-actions[bot]`. Pull before pushing from the laptop.
- The builders only rewrite files when the data changed. The first bot run rewrote every file just to update timestamps.
- `.nojekyll` is present, so Pages serves files as they are.
- `.gitignore` covers `__pycache__/` and `tools/candidates.json`.
