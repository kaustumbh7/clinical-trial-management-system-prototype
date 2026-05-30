-- CreateTable
CREATE TABLE "AeReportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "autoStreamPause" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AeReportTemplate_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdverseEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REPORTED',
    "fields" TEXT NOT NULL,
    "photoPaths" TEXT,
    "summary" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triagedAt" DATETIME,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "resolution" TEXT,
    CONSTRAINT "AdverseEvent_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdverseEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdverseEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AeReportTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "staffLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "joinUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegulatoryDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "supersedesId" TEXT,
    "filePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "RegulatoryDocument_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegulatoryDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "RegulatoryDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdverseEvent_studyId_status_idx" ON "AdverseEvent"("studyId", "status");

-- CreateIndex
CREATE INDEX "AdverseEvent_participantId_idx" ON "AdverseEvent"("participantId");

-- CreateIndex
CREATE INDEX "Appointment_studyId_scheduledAt_idx" ON "Appointment"("studyId", "scheduledAt");

-- CreateIndex
CREATE INDEX "RegulatoryDocument_studyId_type_idx" ON "RegulatoryDocument"("studyId", "type");
