-- FKs mais seguras, lock otimista e tabelas de consentimento, auditoria e fila (outbox).

-- Desconectar um banco apaga as contas, mas os lançamentos MANUAIS ligados a elas ficam (account_id = NULL).
-- Os lançamentos do banco (external_id não nulo) passam a ser apagados explicitamente pelo DisconnectBankUseCase.
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quem criou o convite pode apagar a conta sem levar embora o histórico do convite (used_at segue valendo).
ALTER TABLE "invites" ALTER COLUMN "created_by_id" DROP NOT NULL;
ALTER TABLE "invites" DROP CONSTRAINT "invites_created_by_id_fkey";
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lock otimista
ALTER TABLE "financial_plans" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "battles" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_user_id_type_idx" ON "user_consents"("user_id", "type");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "outbox_jobs_status_run_at_idx" ON "outbox_jobs"("status", "run_at");

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: os consentimentos que já existem em users viram linhas no histórico (as colunas antigas continuam).
INSERT INTO "user_consents" ("id", "user_id", "type", "version", "granted_at")
SELECT gen_random_uuid()::text, "id", 'terms', COALESCE("terms_version", 'desconhecida'), "terms_accepted_at"
FROM "users" WHERE "terms_accepted_at" IS NOT NULL;

INSERT INTO "user_consents" ("id", "user_id", "type", "version", "granted_at")
SELECT gen_random_uuid()::text, "id", 'ai', 'anterior-a-2026-11-21', "ai_consent_at"
FROM "users" WHERE "ai_consent_at" IS NOT NULL;
