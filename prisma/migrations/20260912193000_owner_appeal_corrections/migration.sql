-- 重审是新的审计事件，原裁决内容作为快照保留。
ALTER TYPE "RemovalReviewEventType" ADD VALUE 'REOPENED';
ALTER TABLE "project_removal_review_events" ADD COLUMN "decisionSnapshot" "RemovalReviewDecision";
ALTER TABLE "project_removal_review_events" ADD COLUMN "decisionReasonSnapshot" TEXT;
ALTER TABLE "project_removal_review_events" ADD COLUMN "deciderUserIdSnapshot" TEXT;
ALTER TABLE "project_removal_review_events" ADD COLUMN "deciderNameSnapshot" TEXT;
ALTER TABLE "project_removal_review_events" ADD COLUMN "decidedAtSnapshot" TIMESTAMP(3);
