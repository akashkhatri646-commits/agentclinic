-- CreateTable
CREATE TABLE "FailureMode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialistId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "frequency" INTEGER NOT NULL,
    "totalScenarios" INTEGER NOT NULL,
    "failingScenarioIds" TEXT NOT NULL DEFAULT '[]',
    "regressedScenarioIds" TEXT NOT NULL DEFAULT '[]',
    "suggestedSeverity" INTEGER NOT NULL DEFAULT 1,
    "severityOverride" INTEGER,
    "effort" INTEGER NOT NULL DEFAULT 2,
    "lastRunId" TEXT,
    "lastRunVersion" TEXT,
    "firstSeenAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "reappeared" BOOLEAN NOT NULL DEFAULT false,
    "reappearedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "failureModeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "shippedVersion" TEXT,
    "shippedAt" DATETIME,
    "verifiedAt" DATETIME,
    "verifiedByRunId" TEXT,
    "createdById" TEXT,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fix_failureModeId_fkey" FOREIGN KEY ("failureModeId") REFERENCES "FailureMode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fix_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FixEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fixId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    CONSTRAINT "FixEvent_fixId_fkey" FOREIGN KEY ("fixId") REFERENCES "Fix" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FailureMode_specialistId_theme_key" ON "FailureMode"("specialistId", "theme");

-- CreateIndex
CREATE INDEX "Fix_failureModeId_idx" ON "Fix"("failureModeId");

-- CreateIndex
CREATE INDEX "FixEvent_fixId_at_idx" ON "FixEvent"("fixId", "at");
