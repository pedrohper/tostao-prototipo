-- Histórico das anotações à mão que o app apagou sozinho porque o banco confirmou a cobrança.
CREATE TABLE "reconciled_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_in_cents" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,
    "note" TEXT,
    "bank_transaction_id" TEXT,
    "bank_description" TEXT NOT NULL,
    "reconciled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciled_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reconciled_notes_user_id_reconciled_at_idx" ON "reconciled_notes"("user_id", "reconciled_at");

ALTER TABLE "reconciled_notes" ADD CONSTRAINT "reconciled_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
