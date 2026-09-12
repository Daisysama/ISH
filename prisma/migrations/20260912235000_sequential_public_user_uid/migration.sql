-- Lock registrations while numbering existing users to avoid colliding with new accounts.
BEGIN;
LOCK TABLE "users" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "users" ADD COLUMN "uid" INTEGER;
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id")::INTEGER AS "number" FROM "users"
)
UPDATE "users" AS "u" SET "uid" = "numbered"."number" FROM "numbered" WHERE "u"."id" = "numbered"."id";

CREATE SEQUENCE "users_uid_seq" AS INTEGER START WITH 1;
SELECT setval('users_uid_seq', COALESCE(MAX("uid"), 1), COUNT(*) > 0) FROM "users";
ALTER SEQUENCE "users_uid_seq" OWNED BY "users"."uid";
ALTER TABLE "users" ALTER COLUMN "uid" SET DEFAULT nextval('users_uid_seq');
ALTER TABLE "users" ALTER COLUMN "uid" SET NOT NULL;
CREATE UNIQUE INDEX "users_uid_key" ON "users"("uid");
COMMIT;
