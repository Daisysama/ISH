-- “咩！（响应）”协作申请：区别于私人“感兴趣”，会真实送达创作者。
CREATE TYPE "ProjectResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "project_responses" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "responderId" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "message" TEXT,
  "status" "ProjectResponseStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_responses_projectId_responderId_key"
  ON "project_responses"("projectId", "responderId");
CREATE INDEX "project_responses_projectId_status_createdAt_idx"
  ON "project_responses"("projectId", "status", "createdAt");
CREATE INDEX "project_responses_responderId_status_createdAt_idx"
  ON "project_responses"("responderId", "status", "createdAt");

ALTER TABLE "project_responses"
  ADD CONSTRAINT "project_responses_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_responses"
  ADD CONSTRAINT "project_responses_responderId_fkey"
  FOREIGN KEY ("responderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
