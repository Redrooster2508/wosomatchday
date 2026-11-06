---
tags: [deployment]
---
# Deployment

- **Hosting:** GitHub Pages, `main` branch root, repository `Redrooster2508/wosomatchday`.
- **Pushing:** HTTPS with the access token saved in git's credential store. SSH is set up locally, but the key isn't linked to the GitHub account.
- **Caching:** Pages sends `max-age=600`. CSS and JS links carry `?v=N`, raised whenever those files change, so visitors don't see stale styles. This caused the overflow report in [[Log/2026-11-06]].
- **Workflows:** the token lacks the `workflow` scope, so `.github/workflows/players.yml` was refused. Add it on GitHub's website or widen the token. See [[Player stats database]].
- `.nojekyll` is present, so Pages serves files as they are.
- `.gitignore` covers `__pycache__/` and `tools/candidates.json`.
