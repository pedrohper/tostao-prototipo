-- Quando provamos que a pessoa controla o e-mail. NULL = não verificado.
-- Sem backfill de propósito: contas de senha existentes seguem não verificadas, e conta social
-- (password_hash NULL) já é tratada como verificada pelo provedor.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
