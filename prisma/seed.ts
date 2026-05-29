import { prisma } from "../lib/db";
import { generateQrToken } from "../lib/qr";

/**
 * Seed data: One realistic deodorant-efficacy DCT study with a configured
 * Schedule of Events template, two arms, kit inventory, and seed
 * participants at varying lifecycle stages so the prototype is immediately
 * demoable.
 */

async function main() {
  console.log("Resetting DB…");
  await prisma.auditEvent.deleteMany();
  await prisma.sample.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.kit.deleteMany();
  await prisma.kitLot.deleteMany();
  await prisma.kitSku.deleteMany();
  await prisma.taskInstance.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.screenerResponse.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.soeTaskTemplate.deleteMany();
  await prisma.timepoint.deleteMany();
  await prisma.studyArm.deleteMany();
  await prisma.study.deleteMany();
  await prisma.simClock.deleteMany();

  const startDate = new Date("2026-06-01T00:00:00Z");

  console.log("Creating sim clock…");
  await prisma.simClock.create({
    data: { id: "singleton", currentDate: startDate },
  });

  console.log("Creating study…");
  const study = await prisma.study.create({
    data: {
      name: "Botanical Deodorant Efficacy & Skin Tolerance — Phase II",
      code: "DEO-24A",
      status: "ACTIVE",
    },
  });

  const armA = await prisma.studyArm.create({
    data: { studyId: study.id, name: "Arm A — Active Formula", capacity: 60 },
  });
  await prisma.studyArm.create({
    data: { studyId: study.id, name: "Arm B — Control Formula", capacity: 60 },
  });

  console.log("Creating timepoints…");
  const tp = async (name: string, dayOffset: number) =>
    prisma.timepoint.create({ data: { studyId: study.id, name, dayOffset } });

  const tpEnroll = await tp("Enrollment", 0);
  const tpBaseline = await tp("Baseline (Day 0)", 0);
  const tpDay7 = await tp("Day 7 Check-in", 7);
  const tpDay14 = await tp("Day 14 Check-in", 14);
  const tpDay28 = await tp("Day 28 Closeout", 28);

  console.log("Creating SOE template…");

  const consentTpl = await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpEnroll.id,
      name: "Sign Informed Consent",
      description:
        "Review and electronically sign the IRB-approved consent form (v1.0).",
      kind: "CONSENT",
      triggerType: "MANUAL",
      sortOrder: 0,
    },
  });

  const kitShipTpl = await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpEnroll.id,
      name: "Ship study kit",
      description:
        "Coordinator allocates a kit from inventory and ships it to the participant's address.",
      kind: "KIT_SHIP",
      triggerType: "MANUAL",
      sortOrder: 1,
    },
  });

  const kitActivateTpl = await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpBaseline.id,
      name: "Activate your kit",
      description:
        "Scan the QR code on the box once your kit arrives. Activation unlocks your sample-collection tasks.",
      kind: "KIT_ACTIVATE",
      triggerType: "WEBHOOK",
      dependsOnTemplateId: kitShipTpl.id,
      sortOrder: 2,
    },
  });

  const baselineSurvey = await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpBaseline.id,
      name: "Baseline Skin Diary",
      description:
        "Capture pre-trial skin condition, fragrance sensitivity, and current product use.",
      kind: "SURVEY",
      triggerType: "COMPLETION",
      dependsOnTemplateId: consentTpl.id,
      sortOrder: 3,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpBaseline.id,
      name: "Watch: How to Apply Study Product",
      description:
        "2-minute instructional video on standardized application technique.",
      kind: "SURVEY",
      triggerType: "COMPLETION",
      dependsOnTemplateId: baselineSurvey.id,
      sortOrder: 4,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpBaseline.id,
      name: "Baseline microbiome swab",
      description:
        "Collect the labelled baseline tube per the photo guide. Replace tube in the kit.",
      kind: "SAMPLE_COLLECT",
      triggerType: "COMPLETION",
      dependsOnTemplateId: kitActivateTpl.id,
      sortOrder: 5,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay7.id,
      name: "Day 7 Check-in Survey",
      description: "Daily-use experience, any reactions, fragrance perception.",
      kind: "SURVEY",
      triggerType: "TIME",
      reminderOffsetDays: 1,
      sortOrder: 6,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay14.id,
      name: "Day 14 Skin Photo Upload",
      description: "Submit standardized photos of underarm area per the photo guide.",
      kind: "SURVEY",
      triggerType: "TIME",
      reminderOffsetDays: 1,
      sortOrder: 7,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay14.id,
      name: "Day 14 Tolerance Survey",
      description: "Itch/irritation/redness self-assessment.",
      kind: "SURVEY",
      triggerType: "TIME",
      reminderOffsetDays: 1,
      sortOrder: 8,
    },
  });

  const day14SampleTpl = await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay14.id,
      name: "Day 14 microbiome swab",
      description: "Collect the labelled Day-14 tube. Same protocol as baseline.",
      kind: "SAMPLE_COLLECT",
      triggerType: "TIME",
      reminderOffsetDays: 2,
      sortOrder: 9,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay14.id,
      name: "Mail your samples back",
      description:
        "Place tubes in the prepaid return mailer, drop off at any FedEx location.",
      kind: "SAMPLE_RETURN",
      triggerType: "COMPLETION",
      dependsOnTemplateId: day14SampleTpl.id,
      reminderOffsetDays: 2,
      sortOrder: 10,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay28.id,
      name: "Closeout Survey",
      description: "Overall experience, repurchase intent, free-text feedback.",
      kind: "SURVEY",
      triggerType: "TIME",
      reminderOffsetDays: 2,
      sortOrder: 11,
    },
  });

  await prisma.soeTaskTemplate.create({
    data: {
      studyId: study.id,
      timepointId: tpDay28.id,
      name: "Closeout E-Visit",
      description: "30-min wrap-up call with study coordinator.",
      kind: "VISIT",
      triggerType: "TIME",
      reminderOffsetDays: 2,
      sortOrder: 12,
    },
  });

  console.log("Creating kit inventory…");
  const sku = await prisma.kitSku.create({
    data: {
      studyId: study.id,
      code: "DEO-KIT-A",
      name: "DEO-24A standard study kit",
      vendor: "InternalLogistics",
      expiryMonths: 18,
    },
  });
  await prisma.kitLot.create({
    data: {
      skuId: sku.id,
      lotNumber: "L-2026-001",
      quantityOnHand: 80,
      threshold: 12,
      expiryAt: new Date("2027-12-01"),
    },
  });
  await prisma.kitLot.create({
    data: {
      skuId: sku.id,
      lotNumber: "L-2026-002",
      quantityOnHand: 9, // intentionally below threshold for the demo
      threshold: 12,
      expiryAt: new Date("2027-12-01"),
    },
  });

  console.log("Creating seed participants…");
  await prisma.participant.create({
    data: {
      studyId: study.id,
      armId: armA.id,
      name: "Avery Chen",
      email: "avery.chen@example.com",
      status: "LEAD",
    },
  });
  await prisma.participant.create({
    data: {
      studyId: study.id,
      armId: armA.id,
      name: "Jordan Patel",
      email: "jordan.patel@example.com",
      status: "SCREENED",
    },
  });

  console.log("Logging seed audit event…");
  await prisma.auditEvent.create({
    data: {
      actorKind: "SYSTEM",
      actorLabel: "seed",
      action: "STUDY_CREATED",
      targetType: "Study",
      targetId: study.id,
      studyId: study.id,
      metadata: JSON.stringify({ code: study.code }),
    },
  });

  // Silence the "generated but unused" warning — the QR generator is used
  // at runtime when kits are allocated.
  void generateQrToken;

  console.log("Seed complete.");
  console.log(`  Study:        ${study.code} (${study.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
