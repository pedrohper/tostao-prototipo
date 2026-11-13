-- Acertos: pessoas com quem a pessoa tem dinheiro a acertar, e o lançamento ligado a uma delas.
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "people_user_id_name_key" ON "people"("user_id", "name");
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD COLUMN "person_id" TEXT;
CREATE INDEX "transactions_person_id_idx" ON "transactions"("person_id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
