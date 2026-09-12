CREATE TYPE "RemovalReviewRecipient" AS ENUM ('FOUNDER', 'PLATFORM');
CREATE TYPE "RemovalReviewStatus" AS ENUM ('PENDING', 'RESOLVED');
CREATE TYPE "RemovalReviewDecision" AS ENUM ('RESTORED', 'DECLINED', 'NO_VIOLATION', 'RECORD_CORRECTION', 'MISCONDUCT');
CREATE TYPE "RemovalReviewEventType" AS ENUM ('SUBMITTED', 'RESOLVED');
ALTER TYPE "ProjectActivityType" ADD VALUE 'MEMBER_RESTORED';

CREATE TABLE "project_removal_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL,
    "removedByUserIdSnapshot" TEXT NOT NULL,
    "removedByNameSnapshot" TEXT NOT NULL,
    "reasonSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_removal_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_removal_records_membershipId_removedAt_key"
ON "project_removal_records"("membershipId", "removedAt");
CREATE INDEX "project_removal_records_projectId_removedAt_idx"
ON "project_removal_records"("projectId", "removedAt");
ALTER TABLE "project_removal_records" ADD CONSTRAINT "project_removal_records_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_records" ADD CONSTRAINT "project_removal_records_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "project_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 为旧版已经被移出的成员建立最小历史回执；不改动其成员状态。
INSERT INTO "project_removal_records"
("id", "projectId", "membershipId", "removedAt", "removedByUserIdSnapshot", "removedByNameSnapshot", "reasonSnapshot")
SELECT md5(m."id" || ':' || m."leftAt"::text), m."projectId", m."id", m."leftAt",
       COALESCE(m."removedByUserId", ''), COALESCE(u."displayName", '项目发起人'),
       COALESCE(m."departureReason", '未提供理由')
FROM "project_memberships" m
LEFT JOIN "users" u ON u."id" = m."removedByUserId"
WHERE m."status" = 'REMOVED' AND m."leftAt" IS NOT NULL;

CREATE TABLE "project_removal_reviews" (
    "id" TEXT NOT NULL,
    "removalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "appellantUserId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL,
    "removedByNameSnapshot" TEXT NOT NULL,
    "removalReasonSnapshot" TEXT NOT NULL,
    "recipient" "RemovalReviewRecipient" NOT NULL,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "RemovalReviewStatus" NOT NULL DEFAULT 'PENDING',
    "decision" "RemovalReviewDecision",
    "decisionReason" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_removal_reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_removal_reviews_removalId_recipient_key"
ON "project_removal_reviews"("removalId", "recipient");
CREATE INDEX "project_removal_reviews_recipient_status_createdAt_idx"
ON "project_removal_reviews"("recipient", "status", "createdAt");
CREATE INDEX "project_removal_reviews_appellantUserId_createdAt_idx"
ON "project_removal_reviews"("appellantUserId", "createdAt");
ALTER TABLE "project_removal_reviews" ADD CONSTRAINT "project_removal_reviews_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_reviews" ADD CONSTRAINT "project_removal_reviews_removalId_fkey"
FOREIGN KEY ("removalId") REFERENCES "project_removal_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_reviews" ADD CONSTRAINT "project_removal_reviews_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "project_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_reviews" ADD CONSTRAINT "project_removal_reviews_appellantUserId_fkey"
FOREIGN KEY ("appellantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_reviews" ADD CONSTRAINT "project_removal_reviews_decidedByUserId_fkey"
FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_removal_review_events" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "RemovalReviewEventType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_removal_review_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_removal_review_events_reviewId_createdAt_idx"
ON "project_removal_review_events"("reviewId", "createdAt");
ALTER TABLE "project_removal_review_events" ADD CONSTRAINT "project_removal_review_events_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "project_removal_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_removal_review_events" ADD CONSTRAINT "project_removal_review_events_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
