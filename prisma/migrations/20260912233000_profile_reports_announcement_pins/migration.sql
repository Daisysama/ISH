ALTER TABLE "site_announcements" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "site_announcements_status_pinnedAt_idx" ON "site_announcements"("status", "pinnedAt");

CREATE TYPE "UserReportStatus" AS ENUM ('PENDING', 'WITHDRAWN', 'RESOLVED');
CREATE TABLE "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetNameSnapshot" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "UserReportStatus" NOT NULL DEFAULT 'PENDING',
    "decision" TEXT,
    "decisionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "user_report_events" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_report_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_reports_status_createdAt_idx" ON "user_reports"("status", "createdAt");
CREATE INDEX "user_reports_reporterId_targetId_createdAt_idx" ON "user_reports"("reporterId", "targetId", "createdAt");
CREATE INDEX "user_reports_targetId_status_idx" ON "user_reports"("targetId", "status");
CREATE INDEX "user_report_events_reportId_createdAt_idx" ON "user_report_events"("reportId", "createdAt");
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_report_events" ADD CONSTRAINT "user_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "user_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
