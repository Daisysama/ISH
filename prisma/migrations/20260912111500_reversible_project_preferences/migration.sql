-- Record whether a project preference produced weak inferred tag signals so an undo can reverse them safely.
ALTER TABLE "project_preferences"
ADD COLUMN "inferredFromProject" BOOLEAN NOT NULL DEFAULT false;
