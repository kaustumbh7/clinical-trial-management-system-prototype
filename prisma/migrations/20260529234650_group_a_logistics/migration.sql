-- CreateTable
CREATE TABLE "KitSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "expiryMonths" INTEGER NOT NULL DEFAULT 24,
    CONSTRAINT "KitSku_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KitLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skuId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 10,
    "expiryAt" DATETIME,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KitLot_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "KitSku" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Kit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotId" TEXT NOT NULL,
    "participantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "qrToken" TEXT NOT NULL,
    "allocatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    CONSTRAINT "Kit_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "KitLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Kit_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kitId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "labelPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    CONSTRAINT "Shipment_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kitId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "timepointId" TEXT,
    "tubeBarcode" TEXT NOT NULL,
    "collectedAt" DATETIME,
    "intakeAt" DATETIME,
    "condition" TEXT,
    "notes" TEXT,
    CONSTRAINT "Sample_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sample_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "KitSku_studyId_code_key" ON "KitSku"("studyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "KitLot_skuId_lotNumber_key" ON "KitLot"("skuId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Kit_qrToken_key" ON "Kit"("qrToken");

-- CreateIndex
CREATE INDEX "Kit_participantId_status_idx" ON "Kit"("participantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingNumber_key" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_tubeBarcode_key" ON "Sample"("tubeBarcode");

-- CreateIndex
CREATE INDEX "Sample_participantId_idx" ON "Sample"("participantId");
