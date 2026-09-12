CREATE TYPE "ProjectUpdateStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');
CREATE TYPE "ProjectUpdateEventType" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REOPENED');
ALTER TYPE "ProjectActivityType" ADD VALUE 'MEMBER_PERMISSIONS_CHANGED';

CREATE TABLE "project_updates" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorNameSnapshot" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "ProjectUpdateStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_updates_status_submittedAt_idx" ON "project_updates"("status", "submittedAt");
CREATE INDEX "project_updates_projectId_status_publishedAt_idx" ON "project_updates"("projectId", "status", "publishedAt");
CREATE INDEX "project_updates_authorId_status_submittedAt_idx" ON "project_updates"("authorId", "status", "submittedAt");
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_update_events" (
  "id" TEXT NOT NULL,
  "updateId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "ProjectUpdateEventType" NOT NULL,
  "note" TEXT,
  "previousStatus" "ProjectUpdateStatus",
  "previousReasonSnapshot" TEXT,
  "previousReviewerIdSnapshot" TEXT,
  "previousReviewedAtSnapshot" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_update_events_updateId_createdAt_idx" ON "project_update_events"("updateId", "createdAt");
ALTER TABLE "project_update_events" ADD CONSTRAINT "project_update_events_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_update_events" ADD CONSTRAINT "project_update_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
