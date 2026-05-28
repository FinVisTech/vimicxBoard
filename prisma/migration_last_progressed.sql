-- Run in Supabase SQL editor to add the lastProgressedAt column.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastProgressedAt" TIMESTAMPTZ;
