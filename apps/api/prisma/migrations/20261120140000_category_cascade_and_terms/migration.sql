-- Apagar a conta quebrava com 23503: regra e orçamento apontavam pra categoria customizada com ON DELETE RESTRICT.
-- Agora, apagar a categoria (direto ou pela cascata User -> Category) leva junto as regras e orçamentos dela.
ALTER TABLE "category_rules" DROP CONSTRAINT "category_rules_category_id_fkey";
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_budgets" DROP CONSTRAINT "category_budgets_category_id_fkey";
ALTER TABLE "category_budgets" ADD CONSTRAINT "category_budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aceite dos Termos/Privacidade no cadastro (sem backfill: contas antigas ficam nulas).
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" TEXT;
