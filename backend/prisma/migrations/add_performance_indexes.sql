-- Day 37: Performance Optimization - Database Indexes
-- Run this migration to add performance indexes

-- Tasks table: most common query patterns
CREATE INDEX IF NOT EXISTS "tasks_list_id_position_idx" ON "tasks"("list_id", "position");
CREATE INDEX IF NOT EXISTS "tasks_status_id_idx" ON "tasks"("status_id");
CREATE INDEX IF NOT EXISTS "tasks_project_id_status_idx" ON "tasks"("project_id", "status");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks"("due_date") WHERE "due_date" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tasks_created_at_idx" ON "tasks"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "tasks_is_deleted_created_at_idx" ON "tasks"("is_deleted", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- Activities table: feed queries
CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "activities_org_id_created_at_idx" ON "activities"("org_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activities_entity_type_entity_id_idx" ON "activities"("entity_type", "entity_id");

-- Notifications table: user feed
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "notifications_org_id_idx" ON "notifications"("organization_id") WHERE "organization_id" IS NOT NULL;

-- Messages table: inbox queries
CREATE INDEX IF NOT EXISTS "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");
CREATE INDEX IF NOT EXISTS "messages_sender_receiver_created_idx" ON "messages"("sender_id", "receiver_id", "created_at" DESC);

-- Time entries: reporting queries  
CREATE INDEX IF NOT EXISTS "time_entries_user_id_created_at_idx" ON "time_entries"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "time_entries_task_id_user_id_idx" ON "time_entries"("task_id", "user_id");

-- Organization members: fast membership lookups
CREATE INDEX IF NOT EXISTS "org_members_user_id_idx" ON "organization_members"("user_id");

-- Space members: fast access checks
CREATE INDEX IF NOT EXISTS "space_members_user_id_idx" ON "space_members"("user_id");

-- Comments: task comment feeds
CREATE INDEX IF NOT EXISTS "comments_task_id_created_at_idx" ON "comments"("task_id", "created_at" DESC);
