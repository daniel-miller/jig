---
name: react-vite-tailwind-shadcn
description: Frontend stack conventions for this org — React 18 + Vite 5 +
  TypeScript strict + Tailwind v4 + shadcn/ui (Radix) + TanStack Query +
  React Router + Zod + lucide-react. Same-origin fetch wrapper with double-
  submit CSRF, SPA bundled into the API's wwwroot at publish. Use when
  building or editing any SPA/marketing site under this org (web/, www/,
  etc.), wiring routes, hooks, or shadcn components.
---

# React + Vite + Tailwind + shadcn Stack

Reference implementation: `bump/web/`.

## Dependencies (baseline)

```json
"dependencies": {
  "@fontsource-variable/geist": "^5.2.8",
  "@fontsource-variable/geist-mono": "^5.2.7",
  "@radix-ui/react-*": "...",
  "@tanstack/react-query": "^5.59.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.1",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.460.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.27.0",
  "tailwind-merge": "^2.5.4",
  "zod": "^3.23.8"
},
"devDependencies": {
  "@tailwindcss/vite": "^4.0.0",
  "@types/react": "^18.3.12",
  "@vitejs/plugin-react": "^4.3.3",
  "shadcn": "^4.7.0",
  "tailwindcss": "^4.0.0",
  "typescript": "^5.6.3",
  "vite": "^5.4.10"
}
```

Add `recharts`, `react-day-picker`, `zustand` only when the feature genuinely needs them. Zustand is allowed only when state crosses unrelated component trees — keep page-local state in React state.

## Toolchain

- Vite 5 + `@vitejs/plugin-react`.
- Tailwind v4 wired via `@tailwindcss/vite` (no PostCSS config, no `tailwind.config.js` — Tailwind v4 reads `@theme` from `globals.css`).
- shadcn/ui components copied into `src/components/ui/` via the CLI. Do not pull MUI/Bootstrap/Mantine.
- TypeScript strict on. `tsconfig.json` mirrors the bump web tsconfig: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `jsx: react-jsx`, `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `paths: { "@/*": ["src/*"] }`.

## Vite config

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string };
const appVersion = process.env.APP_VERSION ?? pkg.version;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5135",
      "/swagger": "http://localhost:5135",
    },
  },
  build: { chunkSizeWarningLimit: 1500 },
});
```

`APP_VERSION` is set by `build/build.ps1` so the SPA footer reflects the release version, not the stale `package.json`. Declare `__APP_VERSION__` in `vite-env.d.ts`.

## Layout

```
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
└── src/
    ├── main.tsx
    ├── router.tsx
    ├── vite-env.d.ts
    ├── components/
    │   ├── AppShell.tsx          # shared layout for authenticated routes
    │   └── ui/                   # shadcn components, copied in via CLI
    ├── hooks/                    # useAuth, useStatus, useTheme — thin TanStack Query wrappers
    ├── lib/
    │   ├── api.ts                # fetch wrapper (see below)
    │   ├── cn.ts                 # twMerge(clsx(...)) helper
    │   ├── queryClient.ts        # one QueryClient instance
    │   └── types.ts              # wire-shape interfaces (camelCase, matches API)
    ├── routes/
    │   ├── admin/                # nested under <AppShell />
    │   ├── auth/                 # /login, /login/mfa
    │   └── public/               # board pages, subscribe confirm, unsubscribe
    └── styles/
        └── globals.css           # Tailwind v4 @theme + variables
```

## Entry point

`src/main.tsx` mounts under `<React.StrictMode>` and wraps everything in `<QueryClientProvider>` + `<RouterProvider>`. Variable Geist fonts are imported at the top so the first paint matches the design system.

```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

## Routing

`createBrowserRouter` from `react-router-dom@6`. One `router.tsx` file. Layout routes (e.g. `/admin` rendering `<AppShell />`) nest their children. Always provide a redirect from `/` to the canonical landing route.

## TanStack Query

- One `QueryClient` exported from `src/lib/queryClient.ts`:

  ```ts
  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  });
  ```

- Query keys are arrays of strings + literals (`["status", boardSlug ?? "_all", "all"]`). No object keys.
- One hook per resource in `src/hooks/`. Pages call hooks, hooks call `api()`. Pages never call `fetch` directly.
- Mutations: `useMutation`, invalidate the relevant `queryKey` in `onSuccess`. No optimistic updates unless the UX clearly needs them.
- Long-polling reads use `refetchInterval`; export the interval as a named constant so it's discoverable (e.g. `STATUS_REFETCH_INTERVAL_MS = 30_000`).

## fetch wrapper

`src/lib/api.ts` is the only place `fetch` is called. It:

1. Defaults `Accept: application/json`. Sets `Content-Type: application/json` when a body is present.
2. Reads the non-HttpOnly `bump_csrf` cookie (rename per product) and sends it as `X-Bump-Csrf` on every request. The API ignores it on safe methods.
3. Sets `credentials: "include"` so the session cookie rides on cross-origin requests during local dev (Vite at 5173 → API at 5135).
4. Returns `undefined` for 204, `text` for non-JSON, parsed JSON otherwise.
5. On non-OK, throws `ApiError(status, statusText, problem?)` where `problem` is the parsed `application/problem+json` body when present.

`apiBase` reads `VITE_API_BASE_URL` and falls back to `""` (same-origin). The bundled-SPA layout always uses same-origin; the env var is only for dev when the Vite server is on a different port.

## Forms + validation

- Zod schemas live next to the page that uses them. Parse the form data with `schema.safeParse(...)`; render field errors from `parsed.error.flatten()`.
- Don't reach for react-hook-form unless the form has 5+ fields or genuinely needs uncontrolled inputs. The shadcn `Input`/`Label`/`Textarea` primitives are enough for the typical 1–3 field form.
- Submit handlers are async + call a mutation. Disable the submit button while the mutation is `pending`.

## Styling

- Tailwind utility classes inline; extract to a component before extracting to `@apply`.
- Use `cn()` from `src/lib/cn.ts` (`twMerge(clsx(...))`) whenever a className is conditional or composed.
- Fonts: Geist (sans) + Geist Mono. Set on the body in `globals.css`.
- Icons: lucide-react. No emoji as UI iconography.
- Charts: recharts. One chart component per chart type (`TrendBars`, `HistoryStrip`) under `components/`.
- Dates: date-fns. Never moment.

## shadcn

- Install via the `shadcn` CLI into `src/components/ui/`. Components are owned source, not a dependency — edit them in place when needed.
- Always include `confirm-dialog.tsx` and `danger-zone.tsx` for destructive flows (delete account, drop tenant, etc.). Destructive confirms should require typing the resource slug, not just a button click.
- Theming via CSS variables in `globals.css` `@theme` block (Tailwind v4).

## Type shapes

- `src/lib/types.ts` mirrors the API's wire shape exactly, in camelCase. Update it whenever a server DTO changes.
- Prefer `interface` for object shapes the SPA owns and consumes; `type` aliases for unions, intersections, and mapped types.
- No `any`. If a value's shape is genuinely unknown, type it `unknown` and narrow.

## Build + publish

- `npm run build` = `tsc -b && vite build`. The TS step is type-check only (`noEmit`).
- `npm run lint` = `tsc -b --noEmit` (we use TypeScript's own no-unused-locals/parameters as the lint baseline; no ESLint in the default project).
- Release builds run `npm ci && npm run build` with `APP_VERSION=<version>`, then copy `web/dist/*` into `src/<Api>/wwwroot`. `dotnet publish` then ships the SPA as static content.

## Dev server

- API runs on its default port (Bump.Api dev = 5135). The Vite proxy forwards `/api` and `/swagger`.
- Cookies + CSRF work in dev because the same-origin Vite proxy makes the API look same-origin from the browser's perspective.

## What not to do

- No Next.js. Vite + react-router. Reach for Next only when the project genuinely needs SSR or filesystem routing.
- No MUI/Bootstrap/Mantine. shadcn copied in via the CLI.
- No Redux/Jotai/Recoil. React state by default, Zustand only when state spans unrelated subtrees.
- No SWR. TanStack Query.
- No Axios. The `api()` fetch wrapper is the only HTTP client.
- No CSS-in-JS (styled-components, Emotion, etc.). Tailwind.
- No moment.js. date-fns.
- No `any`. No `// @ts-ignore` without an inline reason.
