-- 回应中心未读结果：只记录“创作者已处理、响应者尚未看过”的决定。
ALTER TABLE "project_responses"
  ADD COLUMN "responderDecisionSeenAt" TIMESTAMP(3);

-- 历史测试 / Alpha 决定不应在升级后突然全部变成“新消息”。
UPDATE "project_responses"
SET "responderDecisionSeenAt" = COALESCE("reviewedAt", "updatedAt")
WHERE "status" IN ('APPROVED', 'REJECTED');

CREATE INDEX "project_responses_responderId_status_responderDecisionSeenAt_idx"
  ON "project_responses"("responderId", "status", "responderDecisionSeenAt");
