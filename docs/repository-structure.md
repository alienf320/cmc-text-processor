# Repository structure

## Public application areas

| Path | Role |
|---|---|
| `server.js` | Express server and HTTP entry point. |
| `src/` | Backend CLI, modules, services, prompts, and utilities. |
| `electron-angular-test/` | Angular frontend and optional Electron shell. The name is retained for now because the existing Angular and Pages workflows reference it. |
| `cloudflare-worker.js` | Worker used by the frontend transcript flow. |
| `docs/` | User and maintainer documentation. |
| `ai/` | Implementation plans, audits, and AI-assisted project decisions. |
| `.github/workflows/` | Deployment automation. |

## Local-only areas

These paths are ignored and must not be published with user data:

- `Entradas/` — local input files.
- `resultados/` — generated Markdown documents.
- `uploads/` — temporary uploads.
- `.env`, OAuth credentials, and token files.
- `node_modules/` and build output.

The filesystem path is intentionally lowercase (`resultados`) so the backend
behaves consistently on Linux, macOS, and Windows. The user-facing screen and
some prose may still call the feature **Resultados**.

## Legacy items requiring later review

- `index.js` and the root `index - *.js` files are historical entry points or
  experiments; the supported commands are defined in `package.json`.
- `deprecated/` is excluded from publication and should be removed only after
  confirming that no workflow depends on it.
- `resultado.md` and `video.txt` are tracked content files and require a manual
  privacy/license review before a public release.
