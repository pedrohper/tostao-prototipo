-- Consentimento explícito (LGPD) pra usar IA. Sem backfill: todo mundo precisa aceitar de novo.
ALTER TABLE "users" ADD COLUMN "ai_consent_at" TIMESTAMP(3);
