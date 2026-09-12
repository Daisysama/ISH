-- 已发布项目修改采用独立 revision 草稿：审核期间不覆盖线上 Project。
CREATE TYPE "ProjectRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ProjectReviewType" AS ENUM ('INITIAL', 'UPDATE');

ALTER TABLE "projects"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "project_moderation_events"
ADD COLUMN "reviewType" "ProjectReviewType" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN "revisionId" TEXT;

CREATE TABLE "project_revisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "stage" "ProjectStage" NOT NULL,
    "purpose" "ProjectPurpose" NOT NULL,
    "audience" "ProjectAudience" NOT NULL,
    "typeTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "seekingTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "externalUrl" TEXT,
    "groupType" TEXT,
    "groupContact" TEXT,
    "groupAccessMode" "GroupAccessMode" NOT NULL DEFAULT 'PRIVATE',
    "allowIshJoinGroup" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProjectRevisionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_revisions_projectId_version_key"
ON "project_revisions"("projectId", "version");

CREATE INDEX "project_revisions_projectId_status_submittedAt_idx"
ON "project_revisions"("projectId", "status", "submittedAt");

CREATE INDEX "project_revisions_status_submittedAt_idx"
ON "project_revisions"("status", "submittedAt");

CREATE INDEX "project_moderation_events_revisionId_createdAt_idx"
ON "project_moderation_events"("revisionId", "createdAt");

ALTER TABLE "project_revisions"
ADD CONSTRAINT "project_revisions_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_revisions"
ADD CONSTRAINT "project_revisions_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_revisions"
ADD CONSTRAINT "project_revisions_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_moderation_events"
ADD CONSTRAINT "project_moderation_events_revisionId_fkey"
FOREIGN KEY ("revisionId") REFERENCES "project_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
