-- Anotação livre em qualquer transação (inclusive as vindas do banco).
ALTER TABLE "transactions" ADD COLUMN "note" TEXT;
