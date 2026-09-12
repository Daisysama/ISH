ALTER TYPE "ProjectStatus" ADD VALUE 'HIDDEN';
ALTER TYPE "UserSanctionScope" ADD VALUE 'COMMENTS';
ALTER TYPE "UserSanctionScope" ADD VALUE 'PROJECTS';
ALTER TYPE "UserSanctionScope" ADD VALUE 'RESPONSES';
ALTER TYPE "UserSanctionScope" ADD VALUE 'SITE';
ALTER TYPE "ProjectUpdateEventType" ADD VALUE 'AUTO_APPROVED';

CREATE TABLE "content_screening_policy" (
  "id" TEXT NOT NULL DEFAULT 'site', "autoApproveClearUpdates" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_screening_policy_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "content_screening_policy_events" (
  "id" TEXT NOT NULL, "policyId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "before" BOOLEAN NOT NULL, "after" BOOLEAN NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_screening_policy_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "content_screening_policy_events_policyId_createdAt_idx" ON "content_screening_policy_events"("policyId", "createdAt");
ALTER TABLE "content_screening_policy_events" ADD CONSTRAINT "content_screening_policy_events_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "content_screening_policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "ProjectReportStatus" AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE "ProjectReportDecision" AS ENUM ('NO_VIOLATION', 'UNLISTED');
CREATE TYPE "ProjectReportAppealDecision" AS ENUM ('UPHELD', 'RESTORED');
CREATE TABLE "project_reports" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "reporterId" TEXT NOT NULL,
  "category" TEXT NOT NULL, "statement" TEXT NOT NULL,
  "titleSnapshot" TEXT NOT NULL, "summarySnapshot" TEXT NOT NULL,
  "descriptionSnapshot" TEXT, "tagsSnapshot" JSONB NOT NULL, "versionSnapshot" INTEGER NOT NULL,
  "status" "ProjectReportStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "ProjectReportDecision", "mergedIntoId" TEXT, "decisionReason" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_reports_projectId_reporterId_versionSnapshot_key" ON "project_reports"("projectId", "reporterId", "versionSnapshot");
CREATE INDEX "project_reports_status_createdAt_idx" ON "project_reports"("status", "createdAt");
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_report_events" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_report_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_report_events_reportId_createdAt_idx" ON "project_report_events"("reportId", "createdAt");
ALTER TABLE "project_report_events" ADD CONSTRAINT "project_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "project_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_report_appeals" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "appellantId" TEXT NOT NULL,
  "originalReviewerId" TEXT, "reporterIdSnapshot" TEXT NOT NULL,
  "reasonSnapshot" TEXT NOT NULL, "statement" TEXT NOT NULL,
  "status" "ProjectReportStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "ProjectReportAppealDecision", "decisionReason" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_report_appeals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_report_appeals_reportId_key" ON "project_report_appeals"("reportId");
CREATE INDEX "project_report_appeals_status_createdAt_idx" ON "project_report_appeals"("status", "createdAt");
ALTER TABLE "project_report_appeals" ADD CONSTRAINT "project_report_appeals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "project_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_report_appeal_events" (
  "id" TEXT NOT NULL, "appealId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_report_appeal_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_report_appeal_events_appealId_createdAt_idx" ON "project_report_appeal_events"("appealId", "createdAt");
ALTER TABLE "project_report_appeal_events" ADD CONSTRAINT "project_report_appeal_events_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "project_report_appeals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
