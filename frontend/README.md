# Silah | صلة — Frontend

Bilingual (AR/EN) frontend for Silah, built with Next.js App Router,
TypeScript, and Tailwind CSS. Auth and onboarding call the real FastAPI
backend; products/prospects/dashboard KPIs still run on local mock data
until Phase 2's Campaign model exists (see `../docs/03-implementation-plan.md`).

## What's built in this pass

**Fully implemented, backed by the real backend:**
- Sign-up (`/signup`) and login (`/login`, or embedded in `/`) call
  `POST /api/v1/auth/register` / `/login` for real -- these create actual
  accounts, not a local-only check
- The onboarding wizard's final step calls
  `POST /api/v1/onboarding/complete`, persisting company info (name,
  industry, website, country, city, description) and personal info (name,
  job title, phone) to the database
- Session handling: a JWT is stored in `localStorage`, verified against
  `GET /api/v1/auth/me` on every load (not just trusted blindly), and used
  to populate the app shell's user menu, dashboard greeting, and settings
  page

**Fully implemented, still on local mock data (Phase 2 will wire these to
the backend once Campaign/Prospect tables exist):**
- Dashboard (`/dashboard`): KPI cards, campaign performance chart
  (Recharts), conversion funnel, products table (search + empty state),
  recent activity
- Products list (`/products`)
- 3-step onboarding wizard UI itself (`/onboarding`) -- Company & Product
  Info, Personal Info, Preview & Confirm -- with React Hook Form + Zod
  validation, and state that survives language/theme switches via
  localStorage. The *product* fields specifically (name, description,
  target market, etc.) aren't sent anywhere yet -- there's no Campaign
  table to put them in. Company and personal fields *do* get saved (above).

**Also fully implemented, backend-independent:**
- Authenticated app shell: sidebar (mirrors in Arabic), top bar, language
  switcher, theme toggle (persisted), user menu
- Settings (`/settings`) -- profile/company read-only (shows real data,
  editing isn't wired up yet), language + theme
- Full i18n: every string in `lib/i18n/en.json` / `ar.json`, RTL mirroring via
  `dir` on `<html>`, no hard-coded text in components
- Light/dark theme, persisted, respects `prefers-color-scheme` on first visit

**Stubbed with a clearly labeled "coming soon" screen (not a dead link, not
fake data)**, planned for the next build slice per
`../docs/03-implementation-plan.md`:
- `/products/new` (5-step campaign creation wizard)
- `/products/[id]` and `/products/[id]/results` (product detail, ranked
  prospects table)
- `/prospects` and `/prospects/[id]` (cross-campaign search, prospect detail
  with score breakdown and outreach editor)
- `/messages` (drafts/approved/sent/replies tabs)

## Getting started

Needs the backend running too -- see the root `README.md`'s "Quick local
test" section for the fastest path (SQLite, no Docker).

```bash
npm install
cp .env.example .env
npm run dev
```

Then sign in at `/en` or `/ar` with `demo@silah.sa` / `Demo123!` -- this
only works if the backend is running and `scripts/init_sqlite_db.py` (or
equivalent) has seeded that account. Without the backend running, register
and login will fail with a "Could not reach the server" message rather
than silently succeeding -- that's intentional now that this is wired to a
real API, not a fallback to fake behavior.

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

These weren't run in the environment that generated this code (no package
registry access there) -- run them as the first step after `npm install` and
fix anything that surfaces before building further on top of this.

## Where real integrations connect

- **API calls**: `lib/api-client/client.ts` is the base `fetch` wrapper
  (typed errors, auth headers); `lib/api-client/auth.ts` has the typed
  register/login/me/onboarding calls. Swap for a client generated from the
  FastAPI backend's OpenAPI schema (see `../docs/01-architecture.md`) if the
  API surface grows much further; don't hand-add more fetch calls directly
  in components.
- **Auth**: `lib/auth/auth-context.tsx` now calls the real backend --
  `login()`/`register()` hit `/api/v1/auth/*`, and the stored JWT is
  re-verified against `/me` on every app load. Nothing left to wire here for
  Phase 1's auth scope.
- **Mock data**: everything remaining in `lib/mock-data/` (products,
  activity, KPIs, funnel) mirrors the shapes in `types/index.ts`, which
  mirror the backend's Pydantic/SQLAlchemy schemas -- but those tables don't
  exist in the backend yet (Phase 2). Replace the mock arrays with API calls
  once they do; component props are already typed against the real shapes.
- **AI agents**: nothing in this frontend calls an agent directly -- all
  agent output (ICP, scores, drafts) arrives through the backend API. No
  frontend change needed when the agents in
  `ghadahHameed/silah-multi-agent-SDA` get wired into the backend.
- **Email sending**: the outreach editor's "Send" action (next build slice)
  will call `POST /api/v1/messages/{id}/send`, simulated in demo mode per the
  product brief -- no frontend change needed when a real provider is added.

## Notes on deviations from the request

- **UI primitives are hand-written**, not installed via the shadcn CLI --
  that CLI needs network access this environment didn't have. They're
  functionally and visually equivalent (Tailwind-based, accessible,
  composable) and live in `components/ui/`; running `npx shadcn@latest add
  <component>` later will work normally and can replace these file-by-file
  if you'd rather have the generated versions.
- **i18n is a small custom Context provider** (`lib/i18n/`), not next-intl --
  the spec allows "next-intl or a similarly structured solution." This keeps
  the dependency list small; swapping to next-intl later mainly means
  replacing the provider/hook, since every component already calls a single
  `t("key")` function.
- **The hero background is a CSS gradient**, not a photo -- no licensed
  Riyadh skyline photo was available to embed. Swap the gradient in
  `components/marketing/LandingHero.tsx` for a real image whenever one is
  supplied.
- Google/Microsoft sign-in buttons are present but disabled with a "not yet
  connected" tooltip, per the instruction not to claim working OAuth that
  isn't implemented.
