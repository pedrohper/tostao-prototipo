-- AlterTable
ALTER TABLE "categories" ADD COLUMN "user_id" TEXT;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contas ocultas (ex.: poupança parada)
ALTER TABLE "accounts" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
