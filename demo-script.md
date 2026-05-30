# QuidoLabs CTMS — Demo Recording Script

A ~7-minute walkthrough hitting the moments that prove the architecture:
the SOE engine is the event spine, every other module either feeds it or
reacts to it. Each scene has a **URL**, what to **say** (paraphrase
freely — keep the bolded beats), and what to **click**.

---

## Pre-flight (off-camera)

```bash
rm -f dev.db dev.db-journal
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

**Browser:** fresh incognito window at 1440×900, light mode, 100% zoom.
Open one tab at `http://localhost:3000`.

---

## Scene 1 — The pitch (~0:00–0:20)

**Where:** `http://localhost:3000`

**Say:**
> "QuidoLabs CTMS — a Clinical Trial Management System organised around
> one idea: the **Schedule of Events is the event spine**. Every module
> feeds it or reacts to it."

**Click:** "Public screener" (bottom-right of the landing).

---

## Scene 2 — Screener → consent → timeline materializes (~0:20–2:00)

**Where:** `/screener/<studyId>`

**Say:**
> "Recruitment starts here. Public eligibility screener, predicate
> qualification, capacity-aware waitlist. No login."

**Fill quickly:**
- Name: `Riley Kim` / Email: `riley.kim@example.com` / Age: `32`
- Lives in US: **Yes** · Daily deodorant: **Yes** · Sensitive: **No** · Allergy: **No**

**Click:** "Check my eligibility" — you're auto-signed-in as Riley.

**Where:** `/portal`

**Say:**
> "Signed in as Riley. **No tasks exist yet** — the engine waits for
> consent before materialising the timeline."

**Click:** "Review & sign consent"

**Where:** `/portal/consent`

**Say:**
> "Typed signature, agreement, immutable consent record."

**Action:** Check the agreement box → click **"Sign & enroll"**.

You'll land back on `/portal` with a **full timeline**.

**Say:**
> "There it is. Signing consent fired `enrollParticipant` into the
> engine, which materialised every task — baseline, Day 7, Day 14,
> Day 28 — in one transaction."

---

## Scene 3 — Complete a task, switch to admin (~2:00–3:00)

**Click:** "Baseline Skin Diary" (top DUE task) → **"Complete task"**.

Back at `/portal`: notice "Watch: How to Apply Study Product" just
turned DUE.

**Say:**
> "That dependent task unlocked the moment baseline was completed — a
> COMPLETION trigger in the SOE."

**Action:** **Switch role** (top-right) → on landing, click **"Principal
Investigator"** card.

**Where:** `/admin/studies/<id>`

**Say:**
> "Same data, different perspective. The funnel shows Riley's just
> enrolled."

**Click:** Riley's name in the participants list.

**Where:** `/admin/studies/<id>/participants/<pid>`

Scroll briefly through her timeline + consent record + audit trail.

**Say:**
> "Materialised timeline, consent with the signed PDF, and an
> **append-only audit trail** of every state change."

---

## Scene 4 — Kit lifecycle (~3:00–5:00)

The headline differentiator vs. Jeeva. Take your time here.

**Click:** **"← DEO-24A"** breadcrumb → then **"Kits"** button.

**Where:** `/admin/studies/<id>/kits`

**Say:**
> "Riley needs a kit shipped. She enrolled with a DUE `KIT_SHIP` task —
> she shows up in 'awaiting kit'."

**Click:** **"Allocate & ship"** next to Riley.

**Say:**
> "One click. Inventory decremented from the lowest non-empty lot, QR
> token minted, mock carrier label generated, KIT_SHIP task completed."

**Click:** **"Simulator"** in the top nav.

**Where:** `/admin/sim`

**Say:**
> "The simulator fires what would be real vendor webhooks in production.
> Same engine code path either way."

**Action:** Find Riley's shipment in "Shipments in transit" → click
**"Simulate delivered"**.

**Say:**
> "`shipping.delivered` webhook. The engine looked up the shipment,
> flipped the kit to DELIVERED, and unlocked Riley's KIT_ACTIVATE task."

**Action:** **Switch role** → click Riley's participant card on the
landing.

**Where:** `/portal`

You should see **"Activate your kit"** as the top DUE task.

**Click:** the activate task → **"Activate my kit"**.

Back at `/portal`: **"Baseline microbiome swab"** is now DUE (it
depended on KIT_ACTIVATE).

**Say:**
> "Kit activated. The sample-collection task unlocked through the same
> COMPLETION-trigger pattern. The participant only does the irreducible
> action — every transition flows from the engine."

---

## Scene 5 — Payments + settlement (~5:00–6:00)

**Action:** Switch role back to PI. Navigate to the study → click
**"Payments"**.

**Where:** `/admin/studies/<id>/payments`

**Say:**
> "When Riley completed her baseline survey, the engine matched it
> against a PaymentRule and fired a charge. Pending — settlement comes
> via webhook."

Show the **PENDING** event in the ledger.

**Click:** **"Simulator"** in the top nav → click **"Stripe — payment.settled"** webhook button.

**Say:**
> "Settlement webhook. Nothing in the SOE advances on hope alone."

**Action:** Click back to **Payments** in the breadcrumbs/header. The
event is now **SETTLED**. The "Settled" stat at the top has moved up.

**Click:** **"Budget"** in the study nav.

**Say:**
> "Budget actuals on participant compensation roll straight off the
> append-only payments ledger. Settlement *is* the actual."

---

## Scene 6 — Adverse event auto-pause (~6:00–7:00)

The most architecturally interesting beat. Don't rush.

**Action:** Switch role back to Riley → `/portal`.

**Click:** the red **"Report a problem"** in the portal nav (top-right).

**Where:** `/portal/ae/new`

**Action:**
- Severity: **SERIOUS**
- Summary: `Redness and itching on application site`
- Symptoms: **Redness** · Stopped product: **Yes**
- Click **"Submit report"**.

Back at `/portal`: **scroll through the task list**.

**Say:**
> "Look at her tasks — everything pending is now SKIPPED. Severity was
> SERIOUS and the AE template has auto-pause enabled, so the engine
> paused her entire stream. No more reminders until a coordinator
> resolves this."

**Action:** Switch role back to PI → navigate to **Adverse events** for
the study.

**Where:** `/admin/studies/<id>/ae`

**Action:**
- Click **"Triage"** on Riley's report.
- Type a resolution: `Cleared by Dr. Reyes — resume schedule.`
- Click **"Resolve"**.

**Say:**
> "Resolution restores every paused task to its previous status. The
> stream resumes automatically."

(Optional verify: switch to Riley → /portal → tasks are back.)

---

## Scene 7 — Close on the audit log (~7:00–7:30)

**Click:** **"Audit log"** in the top admin nav.

**Where:** `/admin/audit`

**Say:**
> "Everything we just did is here. Enrollment, consent, task completion,
> kit allocation, shipping webhook, payment requested, payment settled,
> AE reported, stream paused, AE resolved, stream resumed — every state
> change in the system, append-only, with actor, action, target, and
> metadata."

Scroll through briefly.

**Say (closing):**
> "There's more in the prototype — appointments with telehealth seams,
> regulatory document versioning, staff assignment with @mention notes,
> templated communications, an editable study creator with clone-config —
> eighteen of the nineteen modules from the proposal. All running
> through the same engine, all writing to the same audit log."

---

## URL cheat sheet

| Scene | URL |
| --- | --- |
| 1 | `/` |
| 2 | `/screener/<id>` → `/portal/consent` → `/portal` |
| 3 | `/portal/tasks/<id>` → `/admin/studies/<id>` → `/participants/<pid>` |
| 4 | `/admin/studies/<id>/kits` → `/admin/sim` → `/portal` |
| 5 | `/admin/studies/<id>/payments` → `/admin/sim` → `/budget` |
| 6 | `/portal/ae/new` → `/admin/studies/<id>/ae` |
| 7 | `/admin/audit` |

## Recording tips

- **Pause a beat after each state change.** Let status pills flip and
  audit rows appear before moving on.
- **The three load-bearing moments are:** consent materialising the
  timeline (Scene 2), kit-delivered unlocking the activate task (Scene
  4), and AE auto-pausing the stream (Scene 6). If those land cleanly,
  everything else is a victory lap.
- **If you mis-click, say "ignore that" and keep going.** Hard cuts in
  post are fine.

## Cut for time — re-add if you have headroom

- **Appointments** at `/admin/studies/<id>/appointments` — modality
  field reserves the telehealth seam, `.ics` download for participants.
- **Regulatory docs** at `/regulatory` — version-chained repository.
- **Staff assignments + internal notes** — `/admin/staff`,
  `/assignments`, and the notes thread embedded in participant detail.
- **Communications** — advance the sim clock by +7 days to fire a real
  reminder, then check `/admin/studies/<id>/communications` and
  `/portal/inbox`.
- **Editable study management** — `/admin/studies/new` and the
  clone-config flow on `/edit`.

Each is one extra scene of ~30s if you want to extend.
