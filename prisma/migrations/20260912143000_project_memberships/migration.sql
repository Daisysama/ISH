-- Project Membership：响应被接受后建立真实、可持续的项目同行关系。
-- 响应历史只负责记录“曾经申请过什么”；ACTIVE membership 才是当前成员权限依据。

CREATE TYPE "ProjectMembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');

CREATE TABLE "project_memberships" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ProjectMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceResponseId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_memberships_projectId_userId_key"
  ON "project_memberships"("projectId", "userId");

CREATE UNIQUE INDEX "project_memberships_sourceResponseId_key"
  ON "project_memberships"("sourceResponseId");

CREATE INDEX "project_memberships_projectId_status_joinedAt_idx"
  ON "project_memberships"("projectId", "status", "joinedAt");

CREATE INDEX "project_memberships_userId_status_joinedAt_idx"
  ON "project_memberships"("userId", "status", "joinedAt");

ALTER TABLE "project_memberships"
  ADD CONSTRAINT "project_memberships_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_memberships"
  ADD CONSTRAINT "project_memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_memberships"
  ADD CONSTRAINT "project_memberships_sourceResponseId_fkey"
  FOREIGN KEY ("sourceResponseId") REFERENCES "project_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 兼容本地 / Alpha 中已经被接受的历史响应。
-- 直接复用 response id 作为回填 membership id，避免迁移依赖数据库 UUID 扩展；
-- 后续由 Prisma 新建的 membership 仍继续使用 schema 中的 uuid() 默认值。
INSERT INTO "project_memberships" (
  "id",
  "projectId",
  "userId",
  "roles",
  "permissions",
  "status",
  "sourceResponseId",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  response."id",
  response."projectId",
  response."responderId",
  response."roles",
  ARRAY[]::TEXT[],
  'ACTIVE'::"ProjectMembershipStatus",
  response."id",
  COALESCE(response."reviewedAt", response."updatedAt", response."createdAt"),
  response."createdAt",
  response."updatedAt"
FROM "project_responses" AS response
