-- Cartão: limite e vencimento da fatura (vêm do creditData da Pluggy)
ALTER TABLE "accounts" ADD COLUMN "credit_limit_in_cents" INTEGER;
ALTER TABLE "accounts" ADD COLUMN "due_date" TIMESTAMP(3);
