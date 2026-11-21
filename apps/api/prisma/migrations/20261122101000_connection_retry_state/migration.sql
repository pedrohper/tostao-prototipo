-- Política de nova tentativa do sync: conexão com erro tenta de novo a cada 24 h; depois de 3 falhas seguidas
-- vira RECONNECT_REQUIRED (a pessoa precisa reconectar o banco). O valor novo do enum não é usado nesta migration.
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'RECONNECT_REQUIRED';
ALTER TABLE "bank_connections" ADD COLUMN "error_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bank_connections" ADD COLUMN "last_error_at" TIMESTAMPTZ(3);
