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
    "judgeScore" INTEGER,
    "judgeNote" TEXT,
    "expected" TEXT NOT NULL DEFAULT '{}',
    "actual" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "EvalResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EvalResult" ("actual", "category", "expected", "id", "judgeNote", "judgeScore", "passed", "reason", "runId", "scenarioId", "split") SELECT "actual", "category", "expected", "id", "judgeNote", "judgeScore", "passed", "reason", "runId", "scenarioId", "split" FROM "EvalResult";
DROP TABLE "EvalResult";
ALTER TABLE "new_EvalResult" RENAME TO "EvalResult";
CREATE INDEX "EvalResult_runId_idx" ON "EvalResult"("runId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

