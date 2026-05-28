-- Run this manually in Supabase SQL editor before deploying the multi-assignee update.

-- 1. Create the join table
CREATE TABLE IF NOT EXISTS "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

CREATE INDEX IF NOT EXISTS "TaskAssignee_taskId_idx" ON "TaskAssignee"("taskId");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- 2. Migrate existing single-assignee data into the join table
INSERT INTO "TaskAssignee" ("taskId", "userId")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Add foreign key constraints
ALTER TABLE "TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAssignee"
    ADD CONSTRAINT "TaskAssignee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Remove the old single-assignee column
DROP INDEX IF EXISTS "Task_assigneeId_idx";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "assigneeId";
