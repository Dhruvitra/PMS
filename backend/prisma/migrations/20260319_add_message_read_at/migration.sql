-- AlterTable: messages - add read_at column
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

-- CreateIndex: messages read_at for unread queries
CREATE INDEX IF NOT EXISTS "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");
