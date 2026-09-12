-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('IDEA', 'WRITING', 'CONCEPT', 'PROTOTYPE', 'DEMO', 'DEVELOPING', 'TEAM');

-- AlterTable
ALTER TABLE "projects"
  ALTER COLUMN "description" DROP NOT NULL,
  ADD COLUMN "stage" "ProjectStage" NOT NULL DEFAULT 'IDEA',
  ADD COLUMN "typeTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "seekingTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "groupType" TEXT,
  ADD COLUMN "groupContact" TEXT,
  ADD COLUMN "allowIshJoinGroup" BOOLEAN NOT NULL DEFAULT false;
