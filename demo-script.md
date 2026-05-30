# QuidoLabs CTMS — Demo Recording Script

A ~10-minute walkthrough hitting every major module. Each scene has a
**URL**, what to **say** (you can adapt — keep the bolded beats), and what
to **click**. The cumulative arc is the proposal's thesis: the SOE engine
is the event spine, and every other module feeds it or reacts to it.

---

## Pre-flight (off-camera)

Run these once before pressing record so the demo starts from a clean,
predictable state:

```bash
rm -f dev.db dev.db-journal
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

**Browser setup:**
- Window at 1440×900 or larger, browser zoom 100%, light mode.
- Two tabs you'll move between:
  1. `http://localhost:3000` — the demo tab.
  2. `http://localhost:3000/admin/sim` — keep this ready for the
     simulator pivots; you'll switch to it several times.
- Clear cookies / use a fresh incognito window so the role switcher
  starts at "Guest".

**Things to mention up front (off the recording or in the intro):**
- This is a *prototype* with mock data — no real PHI, no real vendors.
- Two portals: desktop-first admin, mobile-first participant.
- 18 of 19 modules from the proposal are wired up.

---

## Scene 1 — Open on the landing (~0:00–0:30)

**Where:** `http://localhost:3000`

**Say:**
> "This is QuidoLabs CTMS — a Clinical Trial Management System we built to
> replace Jeeva. The whole platform is organised around one architectural
> idea: the **Schedule of Events** is the event spine. Every module either
> feeds events into it, or reacts to events coming out."

**Show:**
- Hover over the landing for a second — the three role cards.
- Read out the three pillars at the bottom briefly: **SOE engine**,
  **Append-only audit**, **Study isolation**.

**Click:** the "Public screener" button at the bottom right (or
"Join a study →" top-right). This kicks off the recruitment flow.

---

## Scene 2 — Public screener: recruitment funnel (~0:30–1:30)

**Where:** `/screener/<studyId>`

**Say:**
> "Recruitment starts here — a public eligibility screener. No login.
> Predicate-based qualification with a capacity-aware waitlist."

**Click / fill:**
- Name: `Riley Kim`
- Email: `riley.kim@example.com`
- Age: `32`
- Lives in US: **Yes**
- Uses deodorant daily: **Yes**
- Sensitive skin: **No**
- Known allergy: **No**

**Say while clicking the chips:**
> "Each answer runs through a predicate evaluator. Flunk a hard criterion
> and you get DISQUALIFIED. Pass them all but capacity is full and you
> land on the WAITLIST. Pass everything with capacity? Auto-created
> participant, auto-signed-in."

**Click:** "Check my eligibility"

You'll be redirected to `/portal` as the newly-created participant.

---

## Scene 3 — eConsent (~1:30–2:15)

**Where:** `/portal` then `/portal/consent`

**Say (on /portal landing):**
> "I'm now signed in as Riley. The portal is mobile-first — same screens
> work on a phone. There's only one thing to do: sign consent. **No tasks
> exist yet** — the SOE engine waits for consent to be signed before
> materialising the timeline."

**Click:** "Review & sign consent" → opens `/portal/consent`

**Say:**
> "Consent is IRB-approved version v1.0. Typed signature, agreement
> checkbox. Signing creates an **immutable consent record** and a
> placeholder PDF goes to encrypted storage."

**Action:**
- The name is pre-filled — leave it.
- Tick the "I have read… I agree" checkbox.
- Click **"Sign & enroll"**.

You'll redirect back to `/portal` — and now there's a **timeline**.

**Say (at /portal):**
> "Here's the moment. Signing consent fired `enrollParticipant` into the
> engine, which materialised the full task timeline from the study's SOE
> template. Day 0 baseline survey, Day 7 check-in, Day 14, Day 28 — all
> created in one transaction."

---

## Scene 4 — Complete a task (~2:15–2:45)

**Where:** `/portal`

**Click:** "Baseline Skin Diary" (the top "DUE" task card)

**Say:**
> "Each task has a kind, a trigger, a due date, a status. Completing one
> task can unlock the next via a COMPLETION trigger."

**Action:** Click **"Complete task"** at the bottom.

You'll return to `/portal` — notice that "Watch: How to Apply Study Product"
just turned from PENDING into DUE.

**Say:**
> "That dependent task — 'Watch the application video' — depended on the
> baseline survey via a COMPLETION trigger. The engine activated it the
> moment baseline was completed."

---

## Scene 5 — Switch to admin, see the participant (~2:45–3:45)

**Action:** Click the **"Switch role"** button in the top-right of the
header.

**Where:** `/` (landing)

**Click:** the **"Principal Investigator"** card (Dr. Luma Reyes).

You'll land on `/admin/studies/<studyId>`.

**Say (on study dashboard):**
> "This is the admin side. Same data, different perspective. I can see
> the participant funnel — leads, screened, consented, enrolled. There's
> Riley with one task already completed."

**Show:**
- The participant funnel cards.
- Click on **Riley Kim** in the participants list → goes to participant detail.

**Say (on participant detail):**
> "Per-participant view. Their materialised task timeline, the consent
> record with a link to the signed PDF, and an append-only audit trail
> of every state change."

Scroll down to show the audit list. Point at the **Internal notes** card
underneath.

**Say:**
> "Coordinators can leave threaded internal notes here — staff-only,
> mention each other with @firstname, mark notes resolved when handled."

**Action:** Type a note like `@Sam keep an eye on Riley's photo upload.`
Click **Post**. The note appears with a chip mention.

**Click:** the **`← DEO-24A`** breadcrumb to go back to the study dashboard.

---

## Scene 6 — DCT logistics: ship a kit (~3:45–5:30)

This is the proposal's headline differentiator vs. Jeeva. Take your time.

**Say (on study dashboard):**
> "Here's where the prototype really earns its keep — the DCT logistics
> path. Riley needs a kit shipped to her home, she'll activate it on
> arrival with a QR code, collect samples, ship the kit back."

**Click:** the **"Kits"** button on the study dashboard.

**Where:** `/admin/studies/<id>/kits`

**Say:**
> "Riley shows up in 'awaiting kit'. The engine knows she has a DUE
> `KIT_SHIP` task from when she enrolled."

**Action:** Click **"Allocate & ship"** next to Riley's row.

The page reloads — you'll see a new row in the kit ledger with status
SHIPPED, a real-looking carrier and tracking number (FedEx, UPS, or USPS).

**Say:**
> "One click. The engine decremented inventory from the lowest non-empty
> lot, minted a QR token for the kit, generated a mock carrier label,
> and completed the participant's KIT_SHIP task."

**Click:** the **"Simulator"** button at the top-right (or `/admin/sim`).

**Where:** `/admin/sim`

**Say:**
> "The simulator panel is the demo's centerpiece. It advances time and
> fires vendor webhooks. In production these come from real cron jobs
> and real signed carrier webhooks — but they hit the *same* engine
> code paths."

**Action:** In the **"Shipments in transit"** section, find Riley's
outbound shipment row and click **"Simulate delivered"**.

**Say:**
> "That's a `shipping.delivered` webhook from the mock carrier. The
> engine just looked up the shipment by tracking number, flipped the
> kit to DELIVERED, and unlocked Riley's KIT_ACTIVATE task."

**Action:** Switch roles back to Riley. **Top-right → Switch role → Riley
Kim's participant card** (or directly navigate to the landing and pick
Riley — she's at the screened/enrolled card now).

Actually simpler path: in another tab/window, open `/` and click **the
participant card** (might say "Riley Kim — Screened — needs consent",
ignore the label, she's actually enrolled now). It'll switch you in
as Riley.

**Where:** `/portal`

You should see **"Activate your kit"** as the top DUE task.

**Click:** the activate task → `/portal/tasks/<id>`

**Say:**
> "This is what Riley sees on her phone the day the kit arrives. A QR
> code on the box, the participant portal showing the same token, tap
> to activate."

**Action:** Click **"Activate my kit"**.

You'll return to `/portal` and the **"Baseline microbiome swab"** task
is now DUE (it depended on KIT_ACTIVATE via a COMPLETION trigger).

**Click:** "Baseline microbiome swab" → complete it.

The **"Day 14 microbiome swab"** is still PENDING (it's TIME-triggered
for Day 14) — leave it.

**Say:**
> "Skipping ahead — once Riley collects the Day-14 sample, she'd tap
> 'I've shipped the return' on the SAMPLE_RETURN task. That generates
> a return label. When the carrier confirms delivery to the lab, sample
> intake unlocks for staff."

---

## Scene 7 — Sample intake (~5:30–6:00)

**Switch role back to PI**. Top-right → switch.

**Where:** Navigate to the study, then click **"Samples"** (or jump to
`/admin/studies/<id>/samples`).

**Say:**
> "Lab intake — scan each tube barcode, link to its timepoint, record
> condition. Every intake is audited per-row."

The samples page may be empty for Riley right now (she hasn't shipped
samples back yet in this demo). Mention the workflow but don't
necessarily walk through scanning unless you've returned a kit.

**Optional shortcut to populate this section:** before recording, advance
the sim clock by ~14 days, complete Riley's Day-14 swab + ship return,
then fire `shipping.return_delivered` from the simulator. The samples
page will then have an actionable row.

---

## Scene 8 — Payments (~6:00–7:00)

**Where:** Back to the study dashboard, then click **"Payments"**.

**Say:**
> "When Riley completed her baseline survey a few minutes ago, the engine
> matched it against a `PaymentRule` — '$25 for baseline visit' — and
> fired an idempotent charge through the mock Stripe."

Show the **Payment events ledger** at the bottom. Riley's $25 event
should be there in **PENDING**.

**Say:**
> "Pending. Nothing in the SOE advances on hope alone — we wait for the
> settlement webhook."

**Click:** the **"Simulator"** button.

**Action:** In the webhook list, click **"Stripe — payment.settled"**.

**Say:**
> "Settlement webhook. The engine flips the oldest PENDING event to
> SETTLED and emits an audit row."

**Navigate back to** `/admin/studies/<id>/payments`. The $25 is now
SETTLED. The **Settled** stat at the top has moved up.

**Click:** the **"Budget"** button (or `/admin/studies/<id>/budget`).

**Say:**
> "Budget tracks planned vs. actual. Participant-compensation actuals
> roll straight off the append-only payment events ledger. There's no
> separate accounting — settlement *is* the actual."

---

## Scene 9 — Adverse event auto-pause (~7:00–8:30)

This is the most architecturally interesting beat. Don't rush it.

**Action:** Switch role back to Riley.

**Where:** `/portal`

**Click:** the red **"Report a problem"** link in the top-right of the
portal nav.

**Where:** `/portal/ae/new`

**Say:**
> "If Riley experiences a reaction, she taps 'Report a problem'. The AE
> template is configured per-study — same screen, different fields per
> study."

**Action:**
- Severity: **SERIOUS**
- Summary: `Redness and itching on application site, getting worse`
- Onset: `Day 5`
- Symptoms: **Redness**
- Stopped product: **Yes**

**Click:** "Submit report".

You'll redirect back to `/portal`.

**Say:**
> "Look at what just happened on her task list."

Pause and **scroll** through the timeline — every pending SURVEY,
VISIT, and SAMPLE_COLLECT task that was open is now showing **SKIPPED**.

**Say:**
> "The engine just paused her stream. Because severity was SERIOUS and
> the AE template has auto-pause enabled, every open task was marked
> SKIPPED — the previous status stashed so it can be restored. She's
> not going to be nagged with reminders while a coordinator looks at
> this."

**Action:** Switch role back to PI. Navigate to the study → click
**"Adverse events"** (or `/admin/studies/<id>/ae`).

**Say:**
> "Riley's report is here — SERIOUS, REPORTED. A coordinator triages,
> then resolves with a note."

**Action:**
- Click **"Triage"** on Riley's report.
- Type a resolution: `Cleared by Dr. Reyes — switch to fragrance-free
  formula, resume schedule.`
- Click **"Resolve"**.

**Say:**
> "The moment that resolution lands, the engine restores every paused
> task to its previous status. Riley's stream resumes automatically."

**Action:** Switch role back to Riley → `/portal`. Her tasks are back to
PENDING / DUE / OVERDUE (whatever they were before the pause).

---

## Scene 10 — Quick tour: Appointments, Regulatory, Staff (~8:30–9:15)

Switch back to PI. From the study dashboard, click through three pages
in quick succession — say one line about each.

**Click:** **"Appointments"** → `/admin/studies/<id>/appointments`

**Say:**
> "Appointments. Modality is in-person, e-visit, or video — video's a
> reserved seam for telehealth, not implemented yet. Participants can
> download a real `.ics` file to add the visit to their calendar."

**Click:** **"Regulatory"** → `/admin/studies/<id>/regulatory`

**Say:**
> "Regulatory documents — version-chained. IRB letters, protocol
> versions, consent templates, SOPs. Newer versions supersede older
> ones, nothing's ever deleted."

**Click:** **"Assignments"** → `/admin/studies/<id>/assignments`

**Say:**
> "Per-participant staff assignment. Primary coordinator gets paged on
> overdue tasks and AE reports. Backup picks up coverage."

---

## Scene 11 — Communications: reminders & inbox (~9:15–9:45)

**Click:** the **"Simulator"** in the top nav.

**Action:** Click **"+7 days"** to advance the sim clock by a week.

**Say:**
> "Advancing the clock by 7 sim-days. Anything time-anchored to Day 7
> just transitioned — Riley's Day 7 Check-in survey is now DUE, a
> reminder fired."

Watch the **Engine activity** list at the bottom — you should see
`CLOCK_TICK`, `TASK_BECAME_DUE`, `REMINDER_SENT`.

**Action:** Navigate to the study → **Communications** (or
`/admin/studies/<id>/communications`).

**Say:**
> "Every reminder is a real Message row — channel, recipient, body,
> status. Templates are per-study and use `{{variable}}` substitution."

Switch role to Riley → click **"Inbox"** in the portal nav.

**Say:**
> "Same message from the participant's side. In production this would
> arrive via SendGrid or Twilio — here it's the mock vendor, but the
> code path is identical."

---

## Scene 12 — Editable study management (~9:45–10:15)

Switch back to PI. From any admin screen, click the **"+ New study"**
chip in the top studies strip.

**Where:** `/admin/studies/new`

**Say:**
> "Studies are editable in the admin. New study, give it a name and a
> code, you get a draft with a default arm and an enrollment timepoint
> pre-created."

**Action:**
- Name: `Sunscreen Photoprotection Pilot`
- Code: `SUN-26A`
- Click **"Create study"**.

You'll land on the new study's edit page.

**Say:**
> "From here you'd edit arms, timepoints, the SOE template. The SOE
> editor preserves one critical invariant — tasks that already have
> materialised instances can't be deleted, so existing enrollments stay
> pinned to their version of the SOE."

**Scroll down** to the **"Clone this study"** card.

**Say:**
> "And clone-config copies the entire configuration — arms, timepoints,
> SOE, payment rules, AE templates, message templates — but never PHI.
> Never participants, never kits, never payments."

---

## Scene 13 — Close on the audit log (~10:15–end)

**Click:** **"Audit log"** in the top nav.

**Where:** `/admin/audit`

**Say:**
> "Everything we just did is here. Enrollment, consent, task completion,
> kit allocation, shipping webhook, sample intake, payment requested,
> payment settled, AE reported, stream paused, AE resolved, stream
> resumed, clock advanced, reminder sent, new study created — every
> state change in the system, append-only, with actor, action, target,
> and metadata."

Scroll through the list briefly.

**Say (closing):**
> "In production, that immutability is enforced at three layers — a
> database role with no UPDATE or DELETE grant on this table, periodic
> Merkle-root anchoring to a separately-controlled store, and
> write-once-read-many backup retention for the regulatory horizon.
>
> The prototype demonstrates the architectural shape. Eighteen of the
> nineteen modules from the proposal are here, all running through the
> same engine, all writing to the same audit log, all isolated by
> study_id."

---

## Cheat sheet — URL list in order

| Scene | URL |
| --- | --- |
| 1 | `/` |
| 2 | `/screener/<studyId>` |
| 3 | `/portal/consent` then `/portal` |
| 4 | `/portal/tasks/<taskId>` |
| 5 | `/admin/studies/<id>` then `/admin/studies/<id>/participants/<pid>` |
| 6 | `/admin/studies/<id>/kits` then `/admin/sim` then `/portal` |
| 7 | `/admin/studies/<id>/samples` |
| 8 | `/admin/studies/<id>/payments` then `/admin/sim` then `/admin/studies/<id>/budget` |
| 9 | `/portal/ae/new` then `/admin/studies/<id>/ae` |
| 10 | `/admin/studies/<id>/appointments`, `/regulatory`, `/assignments` |
| 11 | `/admin/sim` then `/admin/studies/<id>/communications` then `/portal/inbox` |
| 12 | `/admin/studies/new` |
| 13 | `/admin/audit` |

## Tips for the recording

- **Pause briefly after each state change.** Let the viewer's eye catch
  the transition (a status pill flipping, a new audit row appearing).
- **Use the "Engine activity" feed in the sim panel as a narration aid.**
  When you fire a webhook, the audit row appearing there is your visual
  confirmation that the engine reacted.
- **If you mis-click, don't restart — say "ignore that"** and move on.
  Hard cuts in post are fine.
- **Don't try to demo everything.** If you're running long, skip Scene 10
  (Appointments/Regulatory/Staff tour) — they're nice-to-have.
- **The real story is Scene 3 (consent → timeline materialises) plus
  Scene 6 (kit lifecycle) plus Scene 9 (AE auto-pause).** If those land
  cleanly, the rest is a victory lap.
