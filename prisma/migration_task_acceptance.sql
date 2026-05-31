CREATE TYPE "TaskAcceptanceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'NEEDS_CLARIFICATION', 'REJECTED');

CREATE TABLE "TaskAcceptance" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "TaskAcceptanceStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "discordChannelId" TEXT,
  "discordMessageId" TEXT,
  "clarificationCommentId" TEXT,

  CONSTRAINT "TaskAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAcceptance_taskId_userId_key" ON "TaskAcceptance"("taskId", "userId");
CREATE UNIQUE INDEX "TaskAcceptance_clarificationCommentId_key" ON "TaskAcceptance"("clarificationCommentId");
CREATE INDEX "TaskAcceptance_status_idx" ON "TaskAcceptance"("status");
CREATE INDEX "TaskAcceptance_userId_status_idx" ON "TaskAcceptance"("userId", "status");
CREATE INDEX "TaskAcceptance_discordMessageId_idx" ON "TaskAcceptance"("discordMessageId");

ALTER TABLE "TaskAcceptance"
  ADD CONSTRAINT "TaskAcceptance_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAcceptance"
  ADD CONSTRAINT "TaskAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAcceptance"
  ADD CONSTRAINT "TaskAcceptance_clarificationCommentId_fkey"
  FOREIGN KEY ("clarificationCommentId") REFERENCES "TaskComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
