# QuidoLabs CTMS — Prototype

A runnable, design-grade prototype of the Clinical Trial Management System
described in [`ctms-proposal.md`](./ctms-proposal.md). The prototype
demonstrates the proposal's central architectural thesis: that the
**Schedule of Events (SOE) engine is the event spine** of the platform —
every other module either feeds it or reacts to it.

This is **not** production HIPAA infrastructure. It is a working artifact
that lets a reviewer drive the full participant lifecycle end-to-end.

## What's in scope

The five modules of the proposal that prove the architectural design:

- **Schedule of Events engine** — deterministic state machine, single
  `handleEvent` entry point, materialises task timelines on enrollment.
- **Participant Portal** — mobile-first task timeline, consent signing,
  task completion.
- **Study Admin Portal** — desktop-first dashboard, participant detail,
  audit log, simulator panel.
- **eConsent** — mock e-signature flow with placeholder PDF generation
  and immutable consent records.
- **Recruitment funnel** — public eligibility screener with
  predicate-based qualification, capacity-aware waitlist, and automatic
  account creation on qualification.

Cross-cutting: **append-only audit log**, mock identity with role
switching, simulated wall clock, simulated vendor webhooks.

## Explicit non-goals

So that scope didn't drift, these are intentionally **not** included:

- No real auth, MFA, SSO, or row-level security (Postgres RLS is
  modelled by `studyId` columns but enforced in app code, not DB).
- No kits, samples, shipments, payments, adverse events, inventory,
  regulatory documents, telehealth.
- No real vendors — DocuSign, Twilio, SendGrid, Stripe, FedEx are
  represented by mock adapters in `lib/mock-vendors/`.
- No native mobile app; the participant portal is responsive web.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) with Turbopack |
| Language | TypeScript |
| Styling | Tailwind v4 with a custom design system |
| DB | SQLite via Prisma 7 + `@prisma/adapter-better-sqlite3` |
| Forms | Server Actions + Zod |
| Fonts | Inter (UI) · Instrument Serif (display) · JetBrains Mono (data) |

## Run it

```bash
npm install
npx prisma migrate dev      # creates ./dev.db
npx tsx prisma/seed.ts      # seeds one study, two leads, the SOE template
npm run dev                 # http://localhost:3000
```

## Demo walkthrough

A reviewer with five minutes can drive the full lifecycle this way:

1. **Landing** at `/`. Pick a role — _Principal Investigator_ enters the
   admin portal; _Casey Morgan_ (or whoever is the seeded lead) enters
   the participant portal.

2. **Public screener** at `/screener/<studyId>` (linked from the
   landing). Fill it out as an eligible adult — you're auto-signed-in
   as the new participant and dropped into the portal.

3. **Sign consent** at `/portal/consent`. Type a name, agree, sign.
   Behind the scenes: a placeholder PDF is written to
   `/public/mock-pdfs/`, an immutable `ConsentRecord` is created, the
   participant moves to `ENROLLED`, and the SOE engine materialises
   their full task timeline.

4. **Task timeline** at `/portal`. The Day 0 baseline survey is
   actionable; everything else is `PENDING` (time-triggered) or waiting
   on a completion dependency. Complete the baseline survey.

5. **Switch role** (top-right) back to **PI**. Visit
   `/admin/studies/<studyId>` — see the participant moved through the
   funnel, the audit log populating, the SOE timepoints laid out.

6. **Simulator** at `/admin/sim`. Click **+7 days**. Watch tasks
   transition PENDING → DUE, reminders fire, and the audit log capture
   every transition. Fire a mock SendGrid webhook to log a vendor
   confirmation. Click **+14 days** to push some tasks into OVERDUE.

7. **Audit log** at `/admin/audit`. Every state change recorded:
   enrollment, consent, task completion, clock ticks, webhook receipts,
   reminders.

## Architecture map

```
app/
  page.tsx                      Landing + role switcher
  layout.tsx                    Root layout, fonts, theme
  admin/                        Desktop-first admin portal
    layout.tsx                  Shell with study selector + sim-date pill
    studies/[id]/               Study dashboard, SOE, participants, recruitment
    audit/                      Append-only audit log feed
    sim/                        Sim clock + webhook controls
  portal/                       Mobile-first participant portal
    page.tsx                    Task timeline
    tasks/[id]/                 Task detail + completion
    consent/                    eConsent flow
  screener/[studyId]/           Public recruitment screener
  api/webhooks/[type]/          Webhook intake (mirrors prod-shape vendor adapter)
  actions/                      Server actions: role, consent, screener, tasks, sim

lib/
  db.ts                         Prisma client singleton (better-sqlite3 adapter)
  soe/
    engine.ts                   handleEvent — the one entry point for all triggers
    rules.ts                    Template → TaskInstance materialisation
    types.ts                    Event/Trigger type definitions
  audit/log.ts                  Append-only writer (no UPDATE/DELETE paths)
  auth/role.ts                  Mock role-switcher cookie helpers
  mock-vendors/esign.ts         Placeholder PDF generation
  sim-clock.ts                  Read current sim date
  util/cn.ts                    Tailwind merge helper

components/
  RoleSwitcher.tsx              Header pill with sign-out
  ui/                           Button, Card, StatusPill, Logo

prisma/
  schema.prisma                 10 models, all PHI-bearing rows carry studyId
  seed.ts                       One study, two leads, 8 SOE templates
```

## The SOE engine in one paragraph

A single function — `handleEvent` in `lib/soe/engine.ts` — receives every
event in the system: `TASK_COMPLETED`, `CLOCK_TICK`, `WEBHOOK_RECEIVED`,
`MANUAL_OVERRIDE`. Each handler writes deterministic state changes and
emits derived audit records. New triggers are new event-kinds, not new
modules. New modules (kits, payments) become event producers and audit
subscribers without rewriting the engine. This is what the proposal
means by "automation compounds across modules instead of being
re-implemented inside each one."

## The append-only audit log

`lib/audit/log.ts` exports only `appendAudit`. There are no update or
delete code paths anywhere in the codebase. In production, immutability
is layered: (1) database role with no UPDATE/DELETE grant on the audit
table, (2) periodic Merkle-root anchoring to a separately-controlled
store, (3) write-once-read-many backup retention for the regulatory
horizon. The prototype demonstrates (1) by code structure; (2) and (3)
are operational, not application-layer.

## Notes on what's missing vs. production

| Production claim | Prototype state |
| --- | --- |
| Row-level security on `study_id` | Modelled by column on every PHI row; enforced in app code only |
| HIPAA-eligible hosting + BAAs | N/A — local SQLite |
| Federated identity with MFA | Mock role switcher in a cookie |
| Vendor adapter pattern | Real shape (`mock-vendors/esign.ts`); only the e-sign mock is exercised in the prototype |
| Webhook signature verification | Stub — accepts any payload at `/api/webhooks/[type]` |
| Column-level PHI encryption | Not implemented |
| DR drills, pen tests | N/A |

The prototype is shaped so that each of these is a substitution, not a
rewrite — drop in a real identity adapter, change `lib/db.ts` to point
at Postgres with RLS policies, etc.
