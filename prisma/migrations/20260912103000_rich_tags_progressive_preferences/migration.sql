-- Progressive preference learning: private project reactions + inferred tag signals.

CREATE TYPE "ProjectPreferenceKind" AS ENUM ('INTERESTED', 'NOT_INTERESTED');

ALTER TABLE "users"
  ADD COLUMN "suppressInterestedPrompt" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "suppressNotInterestedPrompt" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "user_tag_signals" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "lastSource" TEXT NOT NULL DEFAULT 'PROJECT_INTERACTION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_tag_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" "ProjectPreferenceKind" NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "selectedTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_tag_signals_userId_tag_key" ON "user_tag_signals"("userId", "tag");
CREATE INDEX "user_tag_signals_userId_score_idx" ON "user_tag_signals"("userId", "score");
CREATE UNIQUE INDEX "project_preferences_userId_projectId_key" ON "project_preferences"("userId", "projectId");
CREATE INDEX "project_preferences_userId_hidden_idx" ON "project_preferences"("userId", "hidden");

ALTER TABLE "user_tag_signals"
  ADD CONSTRAINT "user_tag_signals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_preferences"
  ADD CONSTRAINT "project_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_preferences"
  ADD CONSTRAINT "project_preferences_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
