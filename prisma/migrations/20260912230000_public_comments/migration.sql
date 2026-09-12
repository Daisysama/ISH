-- CreateEnum
CREATE TYPE "ProjectCommentStatus" AS ENUM ('PENDING', 'VISIBLE', 'DELETED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProjectCommentReaction" AS ENUM ('LIKE', 'DISLIKE');

-- CreateEnum
CREATE TYPE "ProjectCommentReportStatus" AS ENUM ('PENDING', 'WITHDRAWN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProjectCommentReportDecision" AS ENUM ('NO_VIOLATION', 'HIDDEN', 'AUTHOR_REMOVED');

-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "updateId" TEXT,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "authorNameSnapshot" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ProjectCommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "screeningResult" "ScreeningResult" NOT NULL DEFAULT 'CLEAR',
    "matchedRules" JSONB,
    "hiddenReason" TEXT,
    "hiddenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_events" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "bodySnapshot" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_preferences" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" "ProjectCommentReaction",
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_comment_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_reports" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "status" "ProjectCommentReportStatus" NOT NULL DEFAULT 'PENDING',
    "retractedAt" TIMESTAMP(3),
    "decision" "ProjectCommentReportDecision",
    "decisionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_report_events" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_report_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_appeals" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reportId" TEXT,
    "appellantId" TEXT NOT NULL,
    "originalReviewerId" TEXT,
    "reporterIdSnapshot" TEXT,
    "reasonSnapshot" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "UpdateRemovalAppealStatus" NOT NULL DEFAULT 'PENDING',
    "decision" "UpdateRemovalAppealDecision",
    "decisionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comment_appeal_events" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_comment_appeal_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_comments_projectId_updateId_status_createdAt_idx" ON "project_comments"("projectId", "updateId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "project_comments_parentId_createdAt_idx" ON "project_comments"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "project_comments_authorId_createdAt_idx" ON "project_comments"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "project_comment_events_commentId_createdAt_idx" ON "project_comment_events"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX "project_comment_preferences_userId_hidden_idx" ON "project_comment_preferences"("userId", "hidden");

-- CreateIndex
CREATE UNIQUE INDEX "project_comment_preferences_commentId_userId_key" ON "project_comment_preferences"("commentId", "userId");

-- CreateIndex
CREATE INDEX "project_comment_reports_commentId_reporterId_idx" ON "project_comment_reports"("commentId", "reporterId");

-- CreateIndex
CREATE INDEX "project_comment_reports_status_createdAt_idx" ON "project_comment_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "project_comment_report_events_reportId_createdAt_idx" ON "project_comment_report_events"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_comment_appeals_commentId_key" ON "project_comment_appeals"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "project_comment_appeals_reportId_key" ON "project_comment_appeals"("reportId");

-- CreateIndex
CREATE INDEX "project_comment_appeals_status_createdAt_idx" ON "project_comment_appeals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "project_comment_appeal_events_appealId_createdAt_idx" ON "project_comment_appeal_events"("appealId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "project_updates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "project_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_events" ADD CONSTRAINT "project_comment_events_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "project_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_preferences" ADD CONSTRAINT "project_comment_preferences_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "project_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_preferences" ADD CONSTRAINT "project_comment_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_reports" ADD CONSTRAINT "project_comment_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "project_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_reports" ADD CONSTRAINT "project_comment_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_report_events" ADD CONSTRAINT "project_comment_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "project_comment_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_appeals" ADD CONSTRAINT "project_comment_appeals_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "project_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_appeals" ADD CONSTRAINT "project_comment_appeals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "project_comment_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comment_appeal_events" ADD CONSTRAINT "project_comment_appeal_events_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "project_comment_appeals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
