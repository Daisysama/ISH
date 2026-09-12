ALTER TYPE "ProjectUpdateStatus" ADD VALUE 'HIDDEN';
ALTER TYPE "ProjectUpdateEventType" ADD VALUE 'REVIEW_REQUESTED';
ALTER TYPE "ProjectUpdateEventType" ADD VALUE 'HIDDEN';

CREATE TYPE "ScreeningRuleAction" AS ENUM ('REVIEW', 'BLOCK');
CREATE TYPE "ScreeningResult" AS ENUM ('CLEAR', 'REVIEW', 'BLOCK');
CREATE TYPE "UpdateReportStatus" AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE "UpdateReportDecision" AS ENUM ('NO_VIOLATION', 'CONTENT_REMOVED');

CREATE TABLE "screening_rules" (
  "id" TEXT NOT NULL, "phrase" TEXT NOT NULL, "normalizedPhrase" TEXT NOT NULL,
  "action" "ScreeningRuleAction" NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1, "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "screening_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "screening_rules_normalizedPhrase_key" ON "screening_rules"("normalizedPhrase");
CREATE INDEX "screening_rules_active_action_idx" ON "screening_rules"("active", "action");

CREATE TABLE "screening_rule_events" (
  "id" TEXT NOT NULL, "ruleId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "before" JSONB, "after" JSONB NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "screening_rule_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "screening_rule_events_ruleId_createdAt_idx" ON "screening_rule_events"("ruleId", "createdAt");
ALTER TABLE "screening_rule_events" ADD CONSTRAINT "screening_rule_events_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "screening_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_update_scans" (
  "id" TEXT NOT NULL, "updateId" TEXT NOT NULL, "result" "ScreeningResult" NOT NULL,
  "textHash" TEXT NOT NULL, "matchedRules" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_scans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_update_scans_updateId_key" ON "project_update_scans"("updateId");
ALTER TABLE "project_update_scans" ADD CONSTRAINT "project_update_scans_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_update_reports" (
  "id" TEXT NOT NULL, "updateId" TEXT NOT NULL, "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "statement" TEXT NOT NULL,
  "titleSnapshot" TEXT NOT NULL, "bodySnapshot" TEXT NOT NULL,
  "status" "UpdateReportStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "UpdateReportDecision", "decisionReason" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_update_reports_updateId_reporterId_key" ON "project_update_reports"("updateId", "reporterId");
CREATE INDEX "project_update_reports_status_createdAt_idx" ON "project_update_reports"("status", "createdAt");
ALTER TABLE "project_update_reports" ADD CONSTRAINT "project_update_reports_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_update_reports" ADD CONSTRAINT "project_update_reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_update_reports" ADD CONSTRAINT "project_update_reports_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_update_report_events" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_report_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_update_report_events_reportId_createdAt_idx" ON "project_update_report_events"("reportId", "createdAt");
ALTER TABLE "project_update_report_events" ADD CONSTRAINT "project_update_report_events_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "project_update_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "SiteAnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');
CREATE TABLE "site_announcements" (
  "id" TEXT NOT NULL, "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "body" TEXT NOT NULL,
  "status" "SiteAnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3), "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_announcements_status_publishedAt_idx" ON "site_announcements"("status", "publishedAt");
ALTER TABLE "site_announcements" ADD CONSTRAINT "site_announcements_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "site_announcement_events" (
  "id" TEXT NOT NULL, "announcementId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "titleSnapshot" TEXT NOT NULL, "bodySnapshot" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_announcement_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_announcement_events_announcementId_createdAt_idx" ON "site_announcement_events"("announcementId", "createdAt");
ALTER TABLE "site_announcement_events" ADD CONSTRAINT "site_announcement_events_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "site_announcements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "user_blocks" (
  "id" TEXT NOT NULL, "blockerId" TEXT NOT NULL, "blockedId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMP(3), CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_blocks_blockerId_blockedId_key" ON "user_blocks"("blockerId", "blockedId");
CREATE INDEX "user_blocks_blockerId_active_idx" ON "user_blocks"("blockerId", "active");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "user_block_events" (
  "id" TEXT NOT NULL, "blockId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_block_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_block_events_blockId_createdAt_idx" ON "user_block_events"("blockId", "createdAt");
ALTER TABLE "user_block_events" ADD CONSTRAINT "user_block_events_blockId_fkey"
  FOREIGN KEY ("blockId") REFERENCES "user_blocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "UserSanctionScope" AS ENUM ('POSTING', 'ACCOUNT');
CREATE TYPE "UserSanctionStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "SanctionAppealStatus" AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE "SanctionAppealDecision" AS ENUM ('UPHELD', 'REVOKED');
CREATE TABLE "user_sanctions" (
  "id" TEXT NOT NULL, "targetId" TEXT NOT NULL, "issuedById" TEXT NOT NULL,
  "scope" "UserSanctionScope" NOT NULL, "reason" TEXT NOT NULL,
  "status" "UserSanctionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT, "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sanctions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_sanctions_targetId_status_expiresAt_idx" ON "user_sanctions"("targetId", "status", "expiresAt");
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_issuedById_fkey"
  FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "user_sanction_events" (
  "id" TEXT NOT NULL, "sanctionId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sanction_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_sanction_events_sanctionId_createdAt_idx" ON "user_sanction_events"("sanctionId", "createdAt");
ALTER TABLE "user_sanction_events" ADD CONSTRAINT "user_sanction_events_sanctionId_fkey"
  FOREIGN KEY ("sanctionId") REFERENCES "user_sanctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "user_sanction_appeals" (
  "id" TEXT NOT NULL, "sanctionId" TEXT NOT NULL, "appellantId" TEXT NOT NULL,
  "statement" TEXT NOT NULL, "reasonSnapshot" TEXT NOT NULL,
  "status" "SanctionAppealStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "SanctionAppealDecision", "decisionReason" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sanction_appeals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_sanction_appeals_sanctionId_key" ON "user_sanction_appeals"("sanctionId");
CREATE INDEX "user_sanction_appeals_status_createdAt_idx" ON "user_sanction_appeals"("status", "createdAt");
ALTER TABLE "user_sanction_appeals" ADD CONSTRAINT "user_sanction_appeals_sanctionId_fkey"
  FOREIGN KEY ("sanctionId") REFERENCES "user_sanctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_sanction_appeals" ADD CONSTRAINT "user_sanction_appeals_appellantId_fkey"
  FOREIGN KEY ("appellantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_sanction_appeals" ADD CONSTRAINT "user_sanction_appeals_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "user_sanction_appeal_events" (
  "id" TEXT NOT NULL, "appealId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sanction_appeal_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_sanction_appeal_events_appealId_createdAt_idx" ON "user_sanction_appeal_events"("appealId", "createdAt");
ALTER TABLE "user_sanction_appeal_events" ADD CONSTRAINT "user_sanction_appeal_events_appealId_fkey"
  FOREIGN KEY ("appealId") REFERENCES "user_sanction_appeals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TYPE "UpdateRemovalAppealStatus" AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE "UpdateRemovalAppealDecision" AS ENUM ('UPHELD', 'REOPENED');
CREATE TABLE "project_update_removal_appeals" (
  "id" TEXT NOT NULL, "updateId" TEXT NOT NULL, "hiddenEventId" TEXT NOT NULL,
  "appellantId" TEXT NOT NULL, "originalReviewerId" TEXT, "reporterIdSnapshot" TEXT,
  "reasonSnapshot" TEXT NOT NULL, "statement" TEXT NOT NULL,
  "status" "UpdateRemovalAppealStatus" NOT NULL DEFAULT 'PENDING',
  "decision" "UpdateRemovalAppealDecision", "decisionReason" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_removal_appeals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_update_removal_appeals_hiddenEventId_key" ON "project_update_removal_appeals"("hiddenEventId");
CREATE INDEX "project_update_removal_appeals_status_createdAt_idx" ON "project_update_removal_appeals"("status", "createdAt");
CREATE INDEX "project_update_removal_appeals_updateId_createdAt_idx" ON "project_update_removal_appeals"("updateId", "createdAt");
ALTER TABLE "project_update_removal_appeals" ADD CONSTRAINT "project_update_removal_appeals_updateId_fkey"
  FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_update_removal_appeals" ADD CONSTRAINT "project_update_removal_appeals_hiddenEventId_fkey"
  FOREIGN KEY ("hiddenEventId") REFERENCES "project_update_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_update_removal_appeal_events" (
  "id" TEXT NOT NULL, "appealId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_update_removal_appeal_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_update_removal_appeal_events_appealId_createdAt_idx" ON "project_update_removal_appeal_events"("appealId", "createdAt");
ALTER TABLE "project_update_removal_appeal_events" ADD CONSTRAINT "project_update_removal_appeal_events_appealId_fkey"
  FOREIGN KEY ("appealId") REFERENCES "project_update_removal_appeals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
