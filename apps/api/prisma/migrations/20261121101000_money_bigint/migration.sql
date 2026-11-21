-- Valores monetários em BIGINT (centavos). Alargar INTEGER -> BIGINT não perde nada.
-- O teto de negócio (R$ 100 milhões) é validado nos contratos (Zod); o banco só deixa de estourar em 32 bits.
ALTER TABLE "accounts" ALTER COLUMN "balance_in_cents" SET DATA TYPE BIGINT;
ALTER TABLE "accounts" ALTER COLUMN "credit_limit_in_cents" SET DATA TYPE BIGINT;
ALTER TABLE "transactions" ALTER COLUMN "amount_in_cents" SET DATA TYPE BIGINT;
ALTER TABLE "category_budgets" ALTER COLUMN "limit_in_cents" SET DATA TYPE BIGINT;
ALTER TABLE "reconciled_notes" ALTER COLUMN "amount_in_cents" SET DATA TYPE BIGINT;
