# QuidoLabs CTMS — Demo Recording Script

Read this top-to-bottom. Spoken paragraphs are prose. Stage directions are
in `[brackets]` between paragraphs — do them and keep reading.

---

## Pre-flight (off-camera)

```bash
rm -f dev.db dev.db-journal
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

Open `http://localhost:3000` in a fresh incognito window at 100% zoom.
Hit record when the landing page is on screen.

---

## SCENE 1 — Opening (~20 sec)

`[You're on the landing page at http://localhost:3000]`

This is QuidoLabs CTMS — a clinical trial management system built around one architectural idea. The Schedule of Events — the SOE — is the event spine of the platform. Every module either feeds events into it, or reacts to events coming out of it. Today I'll run a full participant through the platform, end to end.

`[Click the "Public screener" button at the bottom-right of the landing page]`

---

## SCENE 2 — Recruitment, consent, and the timeline materialising (~90 sec)

`[You're at /screener/<studyId>]`

Recruitment starts here, with a public eligibility screener. No login. The questions feed a predicate evaluator that decides if someone qualifies, gets disqualified, or lands on a capacity-aware waitlist.

`[Fill the form:
  Name: Riley Kim
  Email: riley.kim@example.com
  Age: 32
  Lives in US: Yes
  Daily deodorant: Yes
  Sensitive skin: No
  Allergy: No]`

`[Click "Check my eligibility"]`

Riley qualifies. The platform auto-creates her participant record, allocates her to an arm with capacity, and signs her in.

`[You're now at /portal as Riley]`

Here's her portal. Mobile-first — every screen works on a phone too. And notice — there are no tasks yet. The engine deliberately waits for consent before materialising the timeline.

`[Click "Review & sign consent"]`

Consent is the IRB-approved version 1.0. Typed signature, agreement checkbox, and behind the scenes a placeholder PDF gets written to encrypted storage with an immutable audit record.

`[The name field is already pre-filled. Tick the agreement checkbox.]`

`[Click "Sign & enroll"]`

`[You'll redirect back to /portal — and now there's a full task timeline]`

There it is — the moment that makes this prototype interesting. Signing consent fired `enrollParticipant` into the engine. The engine ran `materializeTimeline`, which generated every task instance from the study's SOE template, anchored to today's enrollment date. Day zero baseline, Day 7, Day 14, Day 28 closeout — all created in one transaction, all wired to their respective triggers.

---

## SCENE 3 — Completing a task, then switching to admin (~60 sec)

`[Click the "Baseline Skin Diary" card at the top of the task list]`

Each task has a kind, a trigger, a due date, a status. Completing one task can unlock the next through a COMPLETION trigger — let me show you what I mean.

`[Click the "Complete task" button at the bottom of the page]`

`[You're back at /portal]`

Watch the task list. The instructional video task just turned from PENDING into DUE. It depended on the baseline survey through a COMPLETION trigger — the engine activated it the moment baseline was completed. The participant just does the irreducible action. Everything else flows from engine state.

`[Click "Switch role" in the top-right header. You'll land back at the landing page]`

`[Click the "Principal Investigator" card — Dr. Luma Reyes]`

`[You're now at /admin/studies/<id>]`

Same platform, different perspective. As a PI, I see the participant funnel — leads, screened, consented, enrolled, completed. Riley is in there with one task already completed.

`[Click on Riley Kim's row in the participants list]`

`[You're at the participant detail page]`

Per-participant view. Her materialised task timeline on the left, her signed consent record on the right with a link to the PDF, and an append-only audit trail of every state change that's happened so far.

---

## SCENE 4 — The kit lifecycle (~2 min)

`[Click the "← DEO-24A" breadcrumb to go back to the study dashboard]`

This next bit is what really separates the platform from the previous tool — full decentralised-trial logistics. Riley needs a physical kit shipped to her, and she'll activate it on arrival with a QR code on the box.

`[Click the "Kits" button on the study dashboard]`

`[You're at /admin/studies/<id>/kits]`

Riley shows up in "awaiting kit" because she enrolled with a `KIT_SHIP` task that's DUE for the coordinator. One click and the engine handles the whole allocation.

`[Click "Allocate & ship" next to Riley's name]`

That one click decremented inventory from the lowest non-empty lot, minted a unique QR token for her kit, generated a mock carrier label with a real-looking tracking number, and completed her KIT_SHIP task. Now the kit's in transit.

`[Click "Simulator →" in the top nav]`

`[You're at /admin/sim]`

The simulator panel is how we drive vendor webhooks during the demo. In production, these come from real carrier webhooks and real Stripe webhooks — but they hit the exact same engine code paths that these buttons hit.

`[Find Riley's shipment in the "Shipments in transit" section]`

`[Click "Simulate delivered" next to it]`

A `shipping.delivered` webhook just landed. The engine looked up the shipment by tracking number, flipped the kit's status to DELIVERED, and unlocked Riley's KIT_ACTIVATE task — which had been sitting in PENDING, gated on this exact webhook.

`[Click "Switch role" in the top-right]`

`[Click Riley's participant card on the landing — she's the one labeled "needs consent" but you've already enrolled her]`

`[You're at /portal as Riley]`

Riley's portal now shows "Activate your kit" as her top DUE task — exactly when she'd see it in real life, the day the kit shows up at her door.

`[Click the "Activate your kit" task]`

Here's the QR token on the kit box. In production she scans it with her phone's camera; here we just tap.

`[Click "Activate my kit"]`

`[You're back at /portal]`

Now the baseline microbiome swab task is DUE. It depended on KIT_ACTIVATE through the same COMPLETION-trigger pattern. The whole logistics dance — ship, deliver, activate, collect — flows through one engine, one consistent pattern.

---

## SCENE 5 — Payments and settlement (~60 sec)

`[Click "Switch role" → Principal Investigator card]`

`[Click the DEO-24A study tab in the top studies strip, then click "Payments"]`

`[You're at /admin/studies/<id>/payments]`

When Riley completed her baseline survey a couple minutes ago, the engine matched it against a payment rule — twenty-five dollars for the baseline visit — and immediately fired an idempotent charge through the mock payment processor. You can see it in the ledger here, status PENDING.

Nothing in the engine advances on hope alone. Settlement comes through a webhook.

`[Click "Simulator" in the top nav]`

`[Click the "Stripe — payment.settled" webhook button]`

That's the settlement webhook from the processor. The engine flipped the oldest PENDING event to SETTLED and emitted an audit row.

`[Click the DEO-24A study tab, then "Payments" again]`

The $25 is now SETTLED. The Settled stat at the top of the page has moved up.

`[Click "Budget" in the study nav]`

Budget actuals on participant compensation roll directly off the append-only payments ledger. There's no separate accounting system — settlement is the actual.

---

## SCENE 6 — Adverse event auto-pause (~90 sec)

This next bit is the most architecturally interesting moment. It's worth slowing down for.

`[Click "Switch role"]`

`[Click Riley's participant card on the landing]`

`[You're at /portal]`

If Riley experiences a skin reaction, she taps "Report a problem" up in the corner.

`[Click "Report a problem" — the red link in the top-right of the portal nav]`

`[You're at /portal/ae/new]`

The form is per-study configurable — the questions here come from the AE template the PI set up. She rates severity, writes a quick summary, picks from the template's fields.

`[Click "SERIOUS" for severity]`

`[Type in the summary box: "Redness and itching on application site, getting worse each day"]`

`[Pick "Redness" for the symptoms dropdown, "Yes" for stopped product]`

`[Click "Submit report"]`

`[You're back at /portal — scroll through Riley's task list]`

Look at her task list now. Every survey, visit, and sample collection task that was open is showing SKIPPED. Because severity was SERIOUS and the AE template has auto-pause enabled, the engine paused her entire stream — the previous status of each task is stashed in the payload so it can be restored. No reminders fire while she's waiting for a coordinator to look at this. The system gets out of her way.

`[Click "Switch role" → Principal Investigator]`

`[Click DEO-24A study tab, then "Adverse events"]`

`[You're at /admin/studies/<id>/ae]`

Riley's report is here at the top, marked SERIOUS and REPORTED. The coordinator triages, then resolves with a note.

`[Click "Triage" on Riley's report]`

`[A resolution input appears. Type: "Cleared by Dr. Reyes — switch to fragrance-free formula, resume schedule"]`

`[Click "Resolve"]`

That resolution just told the engine to restore every paused task to its previous status. Her stream picks up exactly where it left off — no manual cleanup, no missed reminders.

---

## SCENE 7 — Closing on the audit log (~30 sec)

`[Click "Audit log" in the top admin nav]`

`[You're at /admin/audit]`

Everything that happened in this demo is here. Enrollment, consent signed, task completed, kit allocated, shipping webhook received, payment requested, payment settled, AE reported, stream paused, AE resolved, stream resumed. Every state change in the system, append-only, with the actor, the action, the target, and the metadata.

`[Scroll through the list briefly]`

In production, that immutability is enforced at three layers — a database role with no UPDATE or DELETE grant on this table, periodic Merkle-root anchoring to a separately controlled store, and write-once-read-many backup retention. The prototype demonstrates the architectural shape — eighteen of the nineteen modules from the proposal are wired up, all running through this same engine, all writing to this same audit log.

That's the platform. Thanks for watching.

`[End recording]`

---

## Cut-for-time scenes — re-add if you have headroom

Each is about 30 seconds. Slot in after Scene 6 if you have extra runway:

**Appointments & telehealth seam** — go to `/admin/studies/<id>/appointments`. Say:
> "Appointments support in-person, e-visit, and video — video's reserved as the telehealth seam, not implemented yet. Participants can download a real `.ics` file to add the visit to their calendar."

**Editable study management** — click the "+ New study" chip in the top nav. Say:
> "Studies are editable in admin. New study, give it a name and a code, you get a draft with a default arm and an enrollment timepoint. From there you'd edit arms, timepoints, the SOE template — and there's a clone-config flow that copies a study's entire configuration without copying any participant data."

**Communications** — advance the sim clock by 7 days from the simulator. Then go to `/admin/studies/<id>/communications`. Say:
> "Every reminder is a real Message row — channel, recipient, body, status. Templates are per-study with variable substitution. The mock vendor is what's wired here — in production it'd be SendGrid or Twilio behind the same adapter interface."

---

## Recording tips

- Pause about a second after each click. Let status pills flip and audit rows appear before you keep reading.
- If you misclick, just say "ignore that" and keep going. Cut it in post.
- The three load-bearing moments are: consent materialising the timeline (Scene 2), kit-delivered unlocking the activate task (Scene 4), and AE auto-pausing the stream (Scene 6). If those land cleanly, everything else is a victory lap.
