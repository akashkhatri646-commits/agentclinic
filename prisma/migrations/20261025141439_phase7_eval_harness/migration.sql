-- CreateTable
CREATE TABLE "EvalRun" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvalResult" (
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
    CONSTRAINT "EvalResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EvalRun_specialistId_version_createdAt_idx" ON "EvalRun"("specialistId", "version", "createdAt");

-- CreateIndex
CREATE INDEX "EvalResult_runId_idx" ON "EvalResult"("runId");
