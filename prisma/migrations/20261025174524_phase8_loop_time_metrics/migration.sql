-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "isSample" BOOLEAN NOT NULL DEFAULT false
);
-- Existing runs: take started/finished from createdAt. changeShippedAt is left empty on
-- purpose: the release time of an old run is unknown and must not be invented.
INSERT INTO "new_EvalRun" ("createdAt", "devPassed", "devTotal", "holdoutPassed", "holdoutTotal", "id", "judgeEnabled", "specialistId", "status", "triggeredBy", "verdict", "verdictReason", "version", "startedAt", "finishedAt") SELECT "createdAt", "devPassed", "devTotal", "holdoutPassed", "holdoutTotal", "id", "judgeEnabled", "specialistId", "status", "triggeredBy", "verdict", "verdictReason", "version", "createdAt", "createdAt" FROM "EvalRun";
DROP TABLE "EvalRun";
ALTER TABLE "new_EvalRun" RENAME TO "EvalRun";
CREATE INDEX "EvalRun_specialistId_version_createdAt_idx" ON "EvalRun"("specialistId", "version", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
