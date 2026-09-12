-- 项目同行者生命周期与内部活动流。
CREATE TYPE "ProjectActivityType" AS ENUM ('MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_REMOVED');

ALTER TABLE "project_memberships"
ADD COLUMN "departureReason" TEXT,
ADD COLUMN "removedByUserId" TEXT;

CREATE TABLE "project_activities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "ProjectActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_activities_projectId_createdAt_idx"
ON "project_activities"("projectId", "createdAt");

CREATE INDEX "project_activities_actorUserId_createdAt_idx"
ON "project_activities"("actorUserId", "createdAt");

ALTER TABLE "project_memberships"
ADD CONSTRAINT "project_memberships_removedByUserId_fkey"
FOREIGN KEY ("removedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_activities"
ADD CONSTRAINT "project_activities_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_activities"
ADD CONSTRAINT "project_activities_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
