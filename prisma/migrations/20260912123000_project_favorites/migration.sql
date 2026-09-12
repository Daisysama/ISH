-- 私人收藏与聚合排序基础。
CREATE TABLE "favorite_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorite_projects_userId_projectId_key"
ON "favorite_projects"("userId", "projectId");

CREATE INDEX "favorite_projects_userId_createdAt_idx"
ON "favorite_projects"("userId", "createdAt");

CREATE INDEX "favorite_projects_projectId_createdAt_idx"
ON "favorite_projects"("projectId", "createdAt");

ALTER TABLE "favorite_projects"
ADD CONSTRAINT "favorite_projects_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorite_projects"
ADD CONSTRAINT "favorite_projects_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
