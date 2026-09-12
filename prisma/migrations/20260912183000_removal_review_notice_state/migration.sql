-- 处理结果需由申请人本人打开相应项目的申诉页后才标记为已看。
ALTER TABLE "project_removal_reviews" ADD COLUMN "appellantDecisionSeenAt" TIMESTAMP(3);

CREATE INDEX "project_removal_reviews_appellantUserId_status_appellantDecisionSeenAt_idx"
ON "project_removal_reviews"("appellantUserId", "status", "appellantDecisionSeenAt");
