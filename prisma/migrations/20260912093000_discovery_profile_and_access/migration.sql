-- Extend project maturity states.
ALTER TYPE "ProjectStage" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "ProjectStage" ADD VALUE IF NOT EXISTS 'LIVE';

-- Project discovery axes.
CREATE TYPE "ProjectPurpose" AS ENUM ('COLLABORATE', 'PLAYTEST', 'FEEDBACK', 'PROMOTE', 'SHARE');
CREATE TYPE "ProjectAudience" AS ENUM ('EVERYONE', 'COLLABORATORS', 'PLAYERS');
CREATE TYPE "GroupAccessMode" AS ENUM ('PUBLIC', 'APPROVAL_REQUIRED', 'PRIVATE');

ALTER TABLE "projects"
  ADD COLUMN "purpose" "ProjectPurpose" NOT NULL DEFAULT 'COLLABORATE',
  ADD COLUMN "audience" "ProjectAudience" NOT NULL DEFAULT 'EVERYONE',
  ADD COLUMN "groupAccessMode" "GroupAccessMode" NOT NULL DEFAULT 'PRIVATE';

-- Optional, self-declared user profile for discovery/recommendation.
ALTER TABLE "users"
  ADD COLUMN "skillTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "likeTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dislikeTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "profileBio" TEXT,
  ADD COLUMN "experienceText" TEXT,
  ADD COLUMN "portfolioUrl" TEXT;

CREATE INDEX "projects_purpose_publishedAt_idx" ON "projects"("purpose", "publishedAt");
CREATE INDEX "projects_audience_publishedAt_idx" ON "projects"("audience", "publishedAt");
