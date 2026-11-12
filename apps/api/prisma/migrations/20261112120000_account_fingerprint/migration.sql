-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "fingerprint" TEXT;

-- CreateIndex
CREATE INDEX "accounts_user_id_fingerprint_idx" ON "accounts"("user_id", "fingerprint");
