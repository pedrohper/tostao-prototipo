-- Fuso, moeda e datas com fuso.
--
-- 1) Toda coluna `timestamp(3)` vira `timestamptz(3)`. O Prisma sempre gravou em UTC, então a conversão
--    `AT TIME ZONE 'UTC'` mantém exatamente o mesmo instante (nenhum dado muda de momento).
-- 2) user_activities.day (texto 'AAAA-MM-DD') vira `date`.
-- 3) users.timezone (IANA), accounts.currency e transactions.currency, com defaults que preservam o comportamento atual.

-- Pré-checagem: day precisa ser uma data de calendário válida em todas as linhas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "user_activities" WHERE "day" !~ '^\d{4}-\d{2}-\d{2}$') THEN
    RAISE EXCEPTION 'user_activities.day tem valor fora de AAAA-MM-DD: corrija antes de migrar';
  END IF;
END $$;

ALTER TABLE "accounts" ALTER COLUMN "due_date" SET DATA TYPE TIMESTAMPTZ(3) USING "due_date" AT TIME ZONE 'UTC';
ALTER TABLE "bank_connections" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "bank_connections" ALTER COLUMN "last_synced_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_synced_at" AT TIME ZONE 'UTC';
ALTER TABLE "battles" ALTER COLUMN "ended_at" SET DATA TYPE TIMESTAMPTZ(3) USING "ended_at" AT TIME ZONE 'UTC';
ALTER TABLE "battles" ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC';
ALTER TABLE "chat_messages" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "email_verification_tokens" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "email_verification_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "email_verification_tokens" ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMPTZ(3) USING "used_at" AT TIME ZONE 'UTC';
ALTER TABLE "financial_plans" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "friendships" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "invites" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "invites" ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMPTZ(3) USING "used_at" AT TIME ZONE 'UTC';
ALTER TABLE "lesson_progress" ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'UTC';
ALTER TABLE "oauth_accounts" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_resets" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_resets" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "password_resets" ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMPTZ(3) USING "used_at" AT TIME ZONE 'UTC';
ALTER TABLE "people" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "reconciled_notes" ALTER COLUMN "occurred_at" SET DATA TYPE TIMESTAMPTZ(3) USING "occurred_at" AT TIME ZONE 'UTC';
ALTER TABLE "reconciled_notes" ALTER COLUMN "reconciled_at" SET DATA TYPE TIMESTAMPTZ(3) USING "reconciled_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "refresh_tokens" ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMPTZ(3) USING "revoked_at" AT TIME ZONE 'UTC';
ALTER TABLE "sent_notifications" ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMPTZ(3) USING "sent_at" AT TIME ZONE 'UTC';
ALTER TABLE "tostao_auto_configs" ALTER COLUMN "last_checked_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_checked_at" AT TIME ZONE 'UTC';
ALTER TABLE "tostao_auto_configs" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';
ALTER TABLE "tostao_insights" ALTER COLUMN "acted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "acted_at" AT TIME ZONE 'UTC';
ALTER TABLE "tostao_insights" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "tostao_insights" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "transactions" ALTER COLUMN "occurred_at" SET DATA TYPE TIMESTAMPTZ(3) USING "occurred_at" AT TIME ZONE 'UTC';
ALTER TABLE "tribunal_votes" ALTER COLUMN "voted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "voted_at" AT TIME ZONE 'UTC';
ALTER TABLE "user_activities" ALTER COLUMN "at" SET DATA TYPE TIMESTAMPTZ(3) USING "at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "ai_consent_at" SET DATA TYPE TIMESTAMPTZ(3) USING "ai_consent_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "email_verified_at" SET DATA TYPE TIMESTAMPTZ(3) USING "email_verified_at" AT TIME ZONE 'UTC';
ALTER TABLE "users" ALTER COLUMN "terms_accepted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "terms_accepted_at" AT TIME ZONE 'UTC';
ALTER TABLE "whatsapp_links" ALTER COLUMN "code_expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "code_expires_at" AT TIME ZONE 'UTC';
ALTER TABLE "whatsapp_links" ALTER COLUMN "linked_at" SET DATA TYPE TIMESTAMPTZ(3) USING "linked_at" AT TIME ZONE 'UTC';

-- day faz parte da chave primária: a conversão reescreve o índice junto.
ALTER TABLE "user_activities" ALTER COLUMN "day" SET DATA TYPE DATE USING "day"::date;

ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE "accounts" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';
ALTER TABLE "transactions" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';
