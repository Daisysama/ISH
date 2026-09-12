-- 站主通过服务端 SITE_OWNER_USER_ID 绑定现有 User.id；授予的管理员保存在数据库。
CREATE TABLE "site_admins" (
  "userId" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_admins_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "site_admins_active_idx" ON "site_admins"("active");
ALTER TABLE "site_admins" ADD CONSTRAINT "site_admins_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "site_governance_events" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforePermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "afterPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_governance_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "site_governance_events_createdAt_idx" ON "site_governance_events"("createdAt");
CREATE INDEX "site_governance_events_targetUserId_createdAt_idx" ON "site_governance_events"("targetUserId", "createdAt");

CREATE TABLE "user_notifications" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "href" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_notifications_recipientUserId_sourceKey_key"
  ON "user_notifications"("recipientUserId", "sourceKey");
CREATE INDEX "user_notifications_recipientUserId_readAt_createdAt_idx"
  ON "user_notifications"("recipientUserId", "readAt", "createdAt");
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
