-- CreateTable
CREATE TABLE "Specialist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "outputFields" TEXT NOT NULL,
    "checks" TEXT NOT NULL,
    "themes" TEXT NOT NULL,
    "judgeField" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Specialist_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialistScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialistId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "input" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "why" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL,
    CONSTRAINT "SpecialistScenario_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpecialistVersionRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialistId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "releasedAt" DATETIME NOT NULL,
    "builtinKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialistVersionRow_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "shape" TEXT NOT NULL DEFAULT '',
    "referenceLists" TEXT
);

-- CreateTable
CREATE TABLE "SpecialistEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialistId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialistEvent_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvalResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "category" TEXT,
    "reason" TEXT,
    "expectedSeverity" TEXT NOT NULL,
    "expectedTherapy" TEXT NOT NULL,
    "actualSeverity" TEXT NOT NULL,
    "actualTherapy" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "judgeScore" INTEGER,
    "judgeNote" TEXT,
    "expected" TEXT NOT NULL DEFAULT '{}',
    "actual" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "EvalResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EvalResult" ("actualSeverity", "actualTherapy", "category", "expectedSeverity", "expectedTherapy", "id", "judgeNote", "judgeScore", "passed", "rationale", "reason", "runId", "scenarioId", "split") SELECT "actualSeverity", "actualTherapy", "category", "expectedSeverity", "expectedTherapy", "id", "judgeNote", "judgeScore", "passed", "rationale", "reason", "runId", "scenarioId", "split" FROM "EvalResult";
DROP TABLE "EvalResult";
ALTER TABLE "new_EvalResult" RENAME TO "EvalResult";
CREATE INDEX "EvalResult_runId_idx" ON "EvalResult"("runId");
CREATE TABLE "new_EvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialistId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "devTotal" INTEGER NOT NULL,
    "devPassed" INTEGER NOT NULL,
    "holdoutTotal" INTEGER NOT NULL,
    "holdoutPassed" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "verdictReason" TEXT NOT NULL,
    "judgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeShippedAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "instanceSlug" TEXT NOT NULL DEFAULT 'standard-clinic',
    "outputsSource" TEXT NOT NULL DEFAULT 'BUILTIN'
);
INSERT INTO "new_EvalRun" ("changeShippedAt", "createdAt", "devPassed", "devTotal", "finishedAt", "holdoutPassed", "holdoutTotal", "id", "isSample", "judgeEnabled", "specialistId", "startedAt", "status", "triggeredBy", "verdict", "verdictReason", "version") SELECT "changeShippedAt", "createdAt", "devPassed", "devTotal", "finishedAt", "holdoutPassed", "holdoutTotal", "id", "isSample", "judgeEnabled", "specialistId", "startedAt", "status", "triggeredBy", "verdict", "verdictReason", "version" FROM "EvalRun";
DROP TABLE "EvalRun";
ALTER TABLE "new_EvalRun" RENAME TO "EvalRun";
CREATE INDEX "EvalRun_specialistId_version_createdAt_idx" ON "EvalRun"("specialistId", "version", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_slug_key" ON "Specialist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistScenario_specialistId_key_key" ON "SpecialistScenario"("specialistId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistVersionRow_specialistId_label_key" ON "SpecialistVersionRow"("specialistId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_slug_key" ON "Instance"("slug");

-- CreateIndex
CREATE INDEX "SpecialistEvent_specialistId_createdAt_idx" ON "SpecialistEvent"("specialistId", "createdAt");

-- Backfill: express stored results in the generic shape (expected/actual by output field).
UPDATE "EvalResult"
SET "expected" = json_object('severity', "expectedSeverity", 'therapy', "expectedTherapy"),
    "actual"   = json_object('severity', "actualSeverity", 'therapy', "actualTherapy", 'rationale', "rationale"),
    "category" = CASE "category"
      WHEN 'SEVERITY' THEN 'MISMATCH:severity'
      WHEN 'THERAPY' THEN 'MISMATCH:therapy'
      WHEN 'SEVERITY_AND_THERAPY' THEN 'MISMATCH:severity+MISMATCH:therapy'
      WHEN 'THERAPY_NOT_IN_CATALOGUE' THEN 'NOT_IN_REFERENCE:therapy'
      WHEN 'RATIONALE' THEN 'EMPTY:rationale'
      ELSE "category" END;
