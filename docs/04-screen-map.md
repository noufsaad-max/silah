# 04 — Screen Map

Maps the brief's screens (§4–§5) to actual Next.js routes and the backend endpoints each one calls.
Every route sits under `[locale]` (`en`/`ar`); Arabic renders mirrored (RTL) per the brief's layout
direction requirement (§12).

| Screen | Route | Primary backend calls | Notes |
|---|---|---|---|
| Login | `/[locale]/login` | `POST /api/v1/auth/login` | Language + theme switcher available pre-login |
| Onboarding | `/[locale]/onboarding` | `POST /api/v1/workspaces`, `POST /api/v1/auth/register` | Company data, personal data, preferences, consent — per brief §4 table |
| Overview dashboard | `/[locale]/overview` | `GET /api/v1/dashboard/kpis`, `GET /api/v1/dashboard/funnel`, `GET /api/v1/campaigns?recent=true`, `GET /api/v1/review-queue` | KPI cards, performance chart, funnel, recent campaigns, review queue |
| Campaigns list | `/[locale]/campaigns` | `GET /api/v1/campaigns` | Create / duplicate / archive / rerun actions |
| Campaign creation | `/[locale]/campaigns/new` | `POST /api/v1/campaigns` | Field groups: Product, Target, Rules, Data, Outreach (brief §5 table) |
| Campaign detail / analysis | `/[locale]/campaigns/[campaignId]` | `POST /api/v1/campaigns/{id}/imports`, `POST /api/v1/campaigns/{id}/icp`, `POST /api/v1/campaigns/{id}/analyze`, `GET /api/v1/campaigns/{id}/results` | Step progress: validating → ICP → scoring → selecting → matching contacts → drafts |
| Prospects (cross-campaign search) | `/[locale]/prospects` | `GET /api/v1/prospects?search=` | Search all companies/contacts across campaigns |
| Prospect detail | `/[locale]/prospects/[prospectId]` | `GET /api/v1/prospects/{id}`, `POST /api/v1/prospects/{id}/contacts`, `POST /api/v1/prospects/{id}/drafts` | Score breakdown, evidence, contacts, outreach editor, timeline |
| Messages | `/[locale]/messages` | `GET /api/v1/messages`, `POST /api/v1/messages/{id}/approve`, `POST /api/v1/messages/{id}/send` | Drafts, sent, replies, failures |
| Data imports | `/[locale]/imports` | `GET /api/v1/campaigns/{id}/imports` | Upload history, field mapping, validation issues |
| Settings | `/[locale]/settings` | `GET/PATCH /api/v1/workspaces/{id}`, `GET/POST /api/v1/users` | Company profile, users, integrations, language, theme |
| Webhook receiver (no UI) | — | `POST /api/v1/webhooks/email` | Signed provider events → updates `messages`/`activity_events` |

## Required states per data screen (brief §12)
Every screen above needs, at minimum: first-use empty state with a meaningful action, skeleton loading
state matching the final layout, actionable error state with retry + incident reference, no-results
state (distinct from "no data at all"), and a permission-denied state that leaks no record details.

## Responsive behavior
- KPI cards stack on mobile; tables become cards or scroll horizontally with a frozen identity column.
- Approval/send actions stay visible on mobile but require a confirmation dialog.
- Arabic mirrors navigation, chevrons, drawers, and step indicators; email addresses and URLs stay LTR
  even inside an RTL layout.
