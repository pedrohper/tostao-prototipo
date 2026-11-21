-- A pessoa pode dizer "isso é transferência" (true) ou "isso NÃO é transferência" (false); NULL = o sistema decide.
-- Sem backfill: tudo que existe hoje continua automático.
ALTER TABLE "transactions" ADD COLUMN "internal_transfer_manual" BOOLEAN;
