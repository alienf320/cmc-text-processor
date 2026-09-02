# Phase 0 audit — publication readiness

Date: 2026-09-02

## Scope

Initial audit before implementing the portfolio plan. This document records
evidence only; it does not certify that the repository is ready to publish.

## Findings

- `.env`, `credentials.json`, `token.json`, and the Google service-account JSON
  exist locally and are ignored by `.gitignore`.
- No sensitive filenames were found in the reachable Git history scan.
- A regex scan of reachable history found zero common API-key/private-key
  candidates outside `node_modules`.
- No common API-key/private-key patterns were found in `HEAD` outside
  `node_modules`. The `client_secret` matches in `src/services/drive.js` are
  property names read from OAuth JSON, not embedded credentials.
- `renew_token.cjs` is a local helper that prints credential values for manual
  deployment setup; it is now ignored and will not be part of the public source.
- `node_modules/` was removed from Git while preserving the local installation.
- The root test command is still a failing placeholder, as recorded in the
  implementation plan.

## Started work

- Added `.env.example` with safe placeholders for current Google/Gemini
  configuration and documented future OpenAI/MEGA variables.
- Added `renew_token.cjs` to `.gitignore` and removed tracked dependencies from
  Git.

## Remaining Phase 0 work

1. Review `Entradas/`, `resultados/`, `uploads/`, and other local data before
   any public push.
2. Normalize files to UTF-8 and verify the publication set.

## Gate

Do not publish or create a public release until the remaining items are
resolved and the final tracked-file audit is clean.
