-- Keep project hiding independent from private interest signals.
-- Existing hidden preferences are migrated before the legacy column is removed.

CREATE TABLE "hidden_projects" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hidden_projects_pkey" PRIMARY KEY ("id")
);

INSERT INTO "hidden_projects" ("id", "userId", "projectId", "createdAt")
SELECT 'migrated-' || "id", "userId", "projectId", CURRENT_TIMESTAMP
FROM "project_preferences"
WHERE "hidden" = true;

CREATE UNIQUE INDEX "hidden_projects_userId_projectId_key" ON "hidden_projects"("userId", "projectId");
CREATE INDEX "hidden_projects_userId_createdAt_idx" ON "hidden_projects"("userId", "createdAt");

ALTER TABLE "hidden_projects"
  ADD CONSTRAINT "hidden_projects_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hidden_projects"
  ADD CONSTRAINT "hidden_projects_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "project_preferences_userId_hidden_idx";
ALTER TABLE "project_preferences" DROP COLUMN "hidden";
