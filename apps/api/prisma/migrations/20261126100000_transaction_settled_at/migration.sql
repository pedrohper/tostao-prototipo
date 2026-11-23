ALTER TABLE "transactions" ADD COLUMN "settled_at" TIMESTAMPTZ(3);

-- Lançamentos já sincronizados do banco, já aplicados no saldo ou com data até hoje começam como pagos/recebidos;
-- lançamentos manuais futuros sem baixa seguem como pendentes.
UPDATE "transactions"
SET "settled_at" = COALESCE("balance_applied_at", "occurred_at")
WHERE "external_id" IS NOT NULL
   OR "balance_applied_at" IS NOT NULL
   OR "occurred_at" <= NOW();

CREATE INDEX "transactions_user_id_settled_at_occurred_at_idx" ON "transactions"("user_id", "settled_at", "occurred_at");
