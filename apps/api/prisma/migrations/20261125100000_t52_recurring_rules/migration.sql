-- T5.2: lançamentos automáticos (recurring_rules) e a trava de saldo dos lançamentos de conta manual.
-- Tudo aditivo: nada muda para o que já existe, a não ser o preenchimento (backfill) de balance_applied_at abaixo.

CREATE TYPE "RecurringKind" AS ENUM ('saida', 'entrada');
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'BIWEEKLY');

CREATE TABLE "recurring_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
    "category_id" TEXT,
    "kind" "RecurringKind" NOT NULL,
    "description" TEXT NOT NULL,
    "amount_in_cents" BIGINT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "total_installments" INTEGER,
    "posted_installments" INTEGER NOT NULL DEFAULT 0,
    "auto_post" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recurring_rules_amount_chk" CHECK ("amount_in_cents" > 0),
    CONSTRAINT "recurring_rules_day_chk" CHECK ("day_of_month" BETWEEN 1 AND 31),
    CONSTRAINT "recurring_rules_installments_chk" CHECK (
      "total_installments" IS NULL OR ("total_installments" BETWEEN 2 AND 120 AND "posted_installments" <= "total_installments")
    ),
    CONSTRAINT "recurring_rules_posted_chk" CHECK ("posted_installments" >= 0)
);

CREATE INDEX "recurring_rules_user_id_idx" ON "recurring_rules"("user_id");
CREATE INDEX "recurring_rules_active_next_run_at_idx" ON "recurring_rules"("active", "next_run_at");

ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trava de saldo: quando o lançamento passou a pesar no saldo de uma conta manual. null = ainda não pesou.
ALTER TABLE "transactions" ADD COLUMN "balance_applied_at" TIMESTAMPTZ(3);

-- Backfill: até hoje, um lançamento de conta manual pesava no saldo se a data dele já tinha chegado NO MOMENTO em que foi
-- criado. Esses ficam marcados (senão o job aplicaria o saldo uma segunda vez). Os criados com data futura continuam null:
-- o job aplica quando a data chegar (era o buraco da T1.5).
UPDATE "transactions" t
SET "balance_applied_at" = t."created_at"
FROM "accounts" a
WHERE t."account_id" = a."id"
  AND a."external_id" LIKE 'manual:%'
  AND t."occurred_at" <= t."created_at";

-- O job procura só o que ainda não pesou numa conta (índice parcial: o Prisma não modela, e o `migrate diff` o ignora).
CREATE INDEX "transactions_balance_pending_idx" ON "transactions"("account_id", "occurred_at")
  WHERE "balance_applied_at" IS NULL AND "account_id" IS NOT NULL;

-- Vínculo explícito de fatura/transferência (detalhe do lançamento): qual conta/cartão é o outro lado.
ALTER TABLE "transactions" ADD COLUMN "linked_account_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "link_kind" TEXT;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_link_kind_chk"
  CHECK ("link_kind" IS NULL OR "link_kind" IN ('card_payment', 'transfer'));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_linked_account_id_fkey"
  FOREIGN KEY ("linked_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
