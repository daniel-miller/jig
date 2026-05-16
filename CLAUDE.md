# Jig

Small collection of browser-side developer utilities — runs entirely client-side, no backend.

## Deploy

GitHub Pages at <https://jig.danielmiller.ca>.

- `.github/workflows/deploy.yml` runs on push to `main`: `npm ci && npm run build` in `src/web`, uploads `dist/` via `actions/upload-pages-artifact`, deploys via `actions/deploy-pages`.
- `src/web/public/CNAME` carries the custom domain into the build output.
- `src/web/public/404.html` + inline restore script in `index.html` implement the rafgraph SPA fallback so deep links (`/favicon`, `/gravatar`, `/hash`) survive a hard reload.
- Repo Pages settings: Source = GitHub Actions. Custom domain = `jig.danielmiller.ca`. Enforce HTTPS.
- DNS at the registrar for `danielmiller.ca`: `CNAME jig` → `daniel-miller.github.io.` (or four A records to Pages apex IPs).

## Pages

| Route | Purpose |
| :--- | :--- |
| `/favicon` | Font Awesome → favicon PNGs (16/32/48/180/192/512) with background style, color, gradient, size. |
| `/gravatar` | Email → Gravatar URL preview, size/default-image/rating/force-default. MD5 in browser. |
| `/hash` | SHA-1/256/512 via Web Crypto + random data (password, hex, UUID, salt). |

## Build, run, test

```powershell
# from repo root
cd src/web
npm install
npm run dev       # Vite dev server, http://localhost:5173
npm run build     # tsc -b && vite build
```

No backend, no database, no migrations. `config/` is unused. `appsettings.work.json` not needed.

## Repo layout

| Folder | Contents |
| :--- | :--- |
| `src/web/` | Vite + React + TS SPA. The whole app. |
| `.claude/skills/` | Bundled Claude Code skills (frontend stack, etc.). Backend skills present but not used here. |

## Conventions

Defaults from `~/.claude/CLAUDE.md` and bundled skills under `.claude/skills/` apply. Project-specific deviations:

- **Backend-only skills do not apply** (`aspnet-api-stack`, `postgres-dapper-migrations`, `dotnet-conventions`, `release-build-script`). Skip them.
- **No backend.** Pure SPA. No `api()` fetch wrapper, no CSRF cookie, no TanStack Query *server* state — only used if a page legitimately needs async caching (none currently).
- **No router proxy.** Vite config omits the `/api`, `/swagger` proxies the skill describes.

## Skills

| Skill | Triggers on | Use |
| :--- | :--- | :--- |
| `react-vite-tailwind-shadcn` | Anything under `src/web/` | The full frontend stack — load when editing pages, hooks, components. |

Other bundled skills (`dotnet-conventions`, `aspnet-api-stack`, `postgres-dapper-migrations`, `release-build-script`) carry org-wide backend conventions and do not apply to this project.

## Stack snapshot

- **Frontend.** React 18 + Vite 5 + TS strict + Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui + React Router 6 + lucide-react + Geist/Geist Mono.
- **No backend, no DB, no auth.**
- **Crypto.** Web Crypto API (`crypto.subtle.digest`, `crypto.getRandomValues`, `crypto.randomUUID`). MD5 via small inline implementation (Gravatar requires it; Web Crypto does not ship MD5).
