-- CreateEnum
CREATE TYPE "ResourceRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "folder_members" ADD COLUMN     "role" "ResourceRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "created_by_id" UUID;

-- AlterTable
ALTER TABLE "list_members" ADD COLUMN     "role" "ResourceRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "lists" ADD COLUMN     "created_by_id" UUID;

-- AlterTable
ALTER TABLE "space_members" ADD COLUMN     "role" "ResourceRole" NOT NULL DEFAULT 'MEMBER';

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
