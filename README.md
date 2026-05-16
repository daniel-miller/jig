# Jig

Three browser-side developer utilities in one SPA: favicon generator, Gravatar URL builder, and hash/random-data generator. All work offline — no server.

## Run locally

```powershell
cd src/web
npm install
npm run dev
```

Open <http://localhost:5173>.

## Build

```powershell
cd src/web
npm run build
```

Static output lands in `src/web/dist/`. Host on any static file server.

## Deploy

Live at <https://jig.danielmiller.ca>. Pushes to `main` build and publish via GitHub Actions (`.github/workflows/deploy.yml`) to GitHub Pages.

## Stack

Vite + React + TypeScript + Tailwind v4 + shadcn/ui. See `CLAUDE.md` for project conventions.

## License

[MIT](LICENSE)
