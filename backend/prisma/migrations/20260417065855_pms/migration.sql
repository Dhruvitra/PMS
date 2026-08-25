/*
  Warnings:

  - The primary key for the `_TaskAssignees` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_TaskTags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `activities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `attachments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `comments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `folder_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `folders` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_by_id` on the `folders` table. All the data in the column will be lost.
  - The primary key for the `invitations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `list_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `lists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_by_id` on the `lists` table. All the data in the column will be lost.
  - The primary key for the `messages` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `organization_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `organizations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `projects` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `space_members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `spaces` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `statuses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `tasks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `is_favorite` on the `tasks` table. All the data in the column will be lost.
  - The primary key for the `time_entries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_TaskAssignees` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_TaskTags` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OrgRole" ADD VALUE 'SUPER_ADMIN';

-- AlterEnum
ALTER TYPE "ResourceRole" ADD VALUE 'OWNER';

-- DropForeignKey
ALTER TABLE "_TaskAssignees" DROP CONSTRAINT "_TaskAssignees_A_fkey";

-- DropForeignKey
ALTER TABLE "_TaskAssignees" DROP CONSTRAINT "_TaskAssignees_B_fkey";

-- DropForeignKey
ALTER TABLE "_TaskTags" DROP CONSTRAINT "_TaskTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_TaskTags" DROP CONSTRAINT "_TaskTags_B_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_uploaded_by_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_task_id_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "folder_members" DROP CONSTRAINT "folder_members_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "folder_members" DROP CONSTRAINT "folder_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "folders" DROP CONSTRAINT "folders_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "folders" DROP CONSTRAINT "folders_space_id_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_id_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "list_members" DROP CONSTRAINT "list_members_list_id_fkey";

-- DropForeignKey
ALTER TABLE "list_members" DROP CONSTRAINT "list_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lists" DROP CONSTRAINT "lists_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "lists" DROP CONSTRAINT "lists_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "lists" DROP CONSTRAINT "lists_space_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_space_id_fkey";

-- DropForeignKey
ALTER TABLE "space_members" DROP CONSTRAINT "space_members_space_id_fkey";

-- DropForeignKey
ALTER TABLE "space_members" DROP CONSTRAINT "space_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "statuses" DROP CONSTRAINT "statuses_list_id_fkey";

-- DropForeignKey
ALTER TABLE "tags" DROP CONSTRAINT "tags_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_list_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parent_task_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_status_id_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_task_id_fkey";

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_user_id_fkey";

-- AlterTable
ALTER TABLE "_TaskAssignees" DROP CONSTRAINT "_TaskAssignees_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "_TaskTags" DROP CONSTRAINT "_TaskTags_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ALTER COLUMN "B" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "activities" DROP CONSTRAINT "activities_pkey",
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "org_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "entity_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_pkey",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "task_id" SET DATA TYPE TEXT,
ALTER COLUMN "uploaded_by_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "comments" DROP CONSTRAINT "comments_pkey",
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "file_type" TEXT,
ADD COLUMN     "file_url" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "task_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ALTER COLUMN "text" DROP NOT NULL,
ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "folder_members" DROP CONSTRAINT "folder_members_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "folder_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "folder_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "folders" DROP CONSTRAINT "folders_pkey",
DROP COLUMN "created_by_id",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "space_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "invited_by_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "list_members" DROP CONSTRAINT "list_members_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "list_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "list_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lists" DROP CONSTRAINT "lists_pkey",
DROP COLUMN "created_by_id",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "space_id" SET DATA TYPE TEXT,
ALTER COLUMN "folder_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "lists_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "messages" DROP CONSTRAINT "messages_pkey",
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "file_type" TEXT,
ADD COLUMN     "file_url" TEXT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "sender_id" SET DATA TYPE TEXT,
ALTER COLUMN "receiver_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_pkey",
ADD COLUMN     "organization_id" TEXT,
ADD COLUMN     "sender_avatar_url" TEXT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "projects" DROP CONSTRAINT "projects_pkey",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_by_id" SET DATA TYPE TEXT,
ALTER COLUMN "space_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "space_members" DROP CONSTRAINT "space_members_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "space_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "space_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_pkey",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_by_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "spaces_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "statuses" DROP CONSTRAINT "statuses_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "list_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "statuses_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tags" DROP CONSTRAINT "tags_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_pkey",
DROP COLUMN "is_favorite",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "start_date" TIMESTAMP(3),
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "project_id" DROP NOT NULL,
ALTER COLUMN "project_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_by_id" SET DATA TYPE TEXT,
ALTER COLUMN "list_id" SET DATA TYPE TEXT,
ALTER COLUMN "status_id" SET DATA TYPE TEXT,
ALTER COLUMN "parent_task_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_pkey",
ADD COLUMN     "is_billable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "task_id" SET DATA TYPE TEXT,
ALTER COLUMN "user_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "_TaskFavorites" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TaskFavorites_AB_unique" ON "_TaskFavorites"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskFavorites_B_index" ON "_TaskFavorites"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TaskAssignees_AB_unique" ON "_TaskAssignees"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_TaskTags_AB_unique" ON "_TaskTags"("A", "B");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_members" ADD CONSTRAINT "folder_members_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_members" ADD CONSTRAINT "folder_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_members" ADD CONSTRAINT "list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskFavorites" ADD CONSTRAINT "_TaskFavorites_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskFavorites" ADD CONSTRAINT "_TaskFavorites_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskTags" ADD CONSTRAINT "_TaskTags_A_fkey" FOREIGN KEY ("A") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskTags" ADD CONSTRAINT "_TaskTags_B_fkey" FOREIGN KEY ("B") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
