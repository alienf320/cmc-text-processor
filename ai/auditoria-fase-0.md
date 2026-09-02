# Phase 0 audit — publication readiness

Date: 2026-09-02

## Scope

Initial audit before implementing the portfolio plan. This document records
evidence only; it does not certify that the repository is ready to publish.

## Findings

- `.env`, `credentials.json`, `token.json`, and the Google service-account JSON
  exist locally and are ignored by `.gitignore`.
- No sensitive filenames were found in the reachable Git history scan.
- No common API-key/private-key patterns were found in `HEAD` outside
  `node_modules`. The `client_secret` matches in `src/services/drive.js` are
  property names read from OAuth JSON, not embedded credentials.
- The working tree contains untracked project artifacts, including
  `renew_token.cjs`, and must be reviewed before publication.
- `node_modules/` contains 2,820 tracked files despite being ignored. This is a
  repository hygiene problem that should be resolved before publishing.
- The root test command is still a failing placeholder, as recorded in the
  implementation plan.

## Started work

- Added `.env.example` with safe placeholders for current Google/Gemini
  configuration and documented future OpenAI/MEGA variables.

## Remaining Phase 0 work

1. Inspect the complete Git history with a dedicated secret scanner.
2. Decide whether `renew_token.cjs` is public, documentation-only, or removed.
3. Remove tracked dependencies from Git without deleting the local install.
4. Review `Entradas/`, `resultados/`, `uploads/`, and other local data before
   any public push.
5. Normalize files to UTF-8 and verify the publication set.

## Gate

Do not publish or create a public release until the remaining items are
resolved and the final tracked-file audit is clean.
