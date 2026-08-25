-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "StatusType" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: spaces
CREATE TABLE IF NOT EXISTS "spaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable: folders
CREATE TABLE IF NOT EXISTS "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "space_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: lists
CREATE TABLE IF NOT EXISTS "lists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "default_view" TEXT NOT NULL DEFAULT 'list',
    "space_id" UUID NOT NULL,
    "folder_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable: statuses
CREATE TABLE IF NOT EXISTS "statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#d1d5db',
    "type" "StatusType" NOT NULL DEFAULT 'OPEN',
    "position" INTEGER NOT NULL DEFAULT 0,
    "list_id" UUID NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- AlterTable: projects - add space_id
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "space_id" UUID;

-- AlterTable: tasks - add new columns
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "list_id" UUID;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status_id" UUID;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" UUID;

-- AlterTable: users - add mobile_no and technology
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mobile_no" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "technology" TEXT;

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "spaces_organization_id_idx" ON "spaces"("organization_id");
CREATE INDEX IF NOT EXISTS "spaces_created_by_id_idx" ON "spaces"("created_by_id");
CREATE INDEX IF NOT EXISTS "spaces_organization_id_position_idx" ON "spaces"("organization_id", "position");

CREATE INDEX IF NOT EXISTS "folders_space_id_idx" ON "folders"("space_id");
CREATE INDEX IF NOT EXISTS "folders_space_id_position_idx" ON "folders"("space_id", "position");

CREATE INDEX IF NOT EXISTS "lists_space_id_idx" ON "lists"("space_id");
CREATE INDEX IF NOT EXISTS "lists_folder_id_idx" ON "lists"("folder_id");
CREATE INDEX IF NOT EXISTS "lists_space_id_position_idx" ON "lists"("space_id", "position");

CREATE INDEX IF NOT EXISTS "statuses_list_id_idx" ON "statuses"("list_id");
CREATE INDEX IF NOT EXISTS "statuses_list_id_position_idx" ON "statuses"("list_id", "position");

CREATE INDEX IF NOT EXISTS "projects_space_id_idx" ON "projects"("space_id");

CREATE INDEX IF NOT EXISTS "tasks_list_id_idx" ON "tasks"("list_id");
CREATE INDEX IF NOT EXISTS "tasks_status_id_idx" ON "tasks"("status_id");
CREATE INDEX IF NOT EXISTS "tasks_parent_task_id_idx" ON "tasks"("parent_task_id");
CREATE INDEX IF NOT EXISTS "tasks_list_id_position_idx" ON "tasks"("list_id", "position");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "folders" ADD CONSTRAINT "folders_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lists" ADD CONSTRAINT "lists_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "lists" ADD CONSTRAINT "lists_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "statuses" ADD CONSTRAINT "statuses_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
