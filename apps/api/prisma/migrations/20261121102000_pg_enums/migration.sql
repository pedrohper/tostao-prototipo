-- Colunas de texto livre viram enums do PostgreSQL (valor inválido passa a ser erro do banco, não bug silencioso).
-- Cada conversão confere antes: se existir valor fora da lista, a migration aborta dizendo qual, sem alterar nada.

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "provider"::text, ', ') INTO bad FROM "oauth_accounts" WHERE "provider"::text NOT IN ('google', 'apple');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'oauth_accounts.provider tem valores fora do enum OAuthProvider: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "status"::text, ', ') INTO bad FROM "bank_connections" WHERE "status"::text NOT IN ('ACTIVE', 'ERROR');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'bank_connections.status tem valores fora do enum ConnectionStatus: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "type"::text, ', ') INTO bad FROM "accounts" WHERE "type"::text NOT IN ('BANK', 'CREDIT');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'accounts.type tem valores fora do enum AccountType: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "kind"::text, ', ') INTO bad FROM "categories" WHERE "kind"::text NOT IN ('saida', 'entrada', 'neutra');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'categories.kind tem valores fora do enum CategoryKind: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "role"::text, ', ') INTO bad FROM "chat_messages" WHERE "role"::text NOT IN ('user', 'assistant');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'chat_messages.role tem valores fora do enum ChatRole: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "channel"::text, ', ') INTO bad FROM "chat_messages" WHERE "channel"::text NOT IN ('app', 'whatsapp');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'chat_messages.channel tem valores fora do enum ChatChannel: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "kind"::text, ', ') INTO bad FROM "battles" WHERE "kind"::text NOT IN ('tigrinho', 'urubu');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'battles.kind tem valores fora do enum BattleKind: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "status"::text, ', ') INTO bad FROM "battles" WHERE "status"::text NOT IN ('ativa', 'vencida', 'perdida');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'battles.status tem valores fora do enum BattleStatus: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "severity"::text, ', ') INTO bad FROM "tostao_insights" WHERE "severity"::text NOT IN ('info', 'warning', 'urgent');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'tostao_insights.severity tem valores fora do enum InsightSeverity: %', bad;
  END IF;
END $$;

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT "status"::text, ', ') INTO bad FROM "tostao_insights" WHERE "status"::text NOT IN ('PENDING', 'APPLIED', 'DISMISSED');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'tostao_insights.status tem valores fora do enum InsightStatus: %', bad;
  END IF;
END $$;


CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple');
CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'ERROR');
CREATE TYPE "AccountType" AS ENUM ('BANK', 'CREDIT');
CREATE TYPE "CategoryKind" AS ENUM ('saida', 'entrada', 'neutra');
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');
CREATE TYPE "ChatChannel" AS ENUM ('app', 'whatsapp');
CREATE TYPE "BattleKind" AS ENUM ('tigrinho', 'urubu');
CREATE TYPE "BattleStatus" AS ENUM ('ativa', 'vencida', 'perdida');
CREATE TYPE "InsightSeverity" AS ENUM ('info', 'warning', 'urgent');
CREATE TYPE "InsightStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

ALTER TABLE "oauth_accounts" ALTER COLUMN "provider" SET DATA TYPE "OAuthProvider" USING "provider"::"OAuthProvider";
ALTER TABLE "bank_connections" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bank_connections" ALTER COLUMN "status" SET DATA TYPE "ConnectionStatus" USING "status"::"ConnectionStatus";
ALTER TABLE "bank_connections" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "accounts" ALTER COLUMN "type" SET DATA TYPE "AccountType" USING "type"::"AccountType";
ALTER TABLE "categories" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "categories" ALTER COLUMN "kind" SET DATA TYPE "CategoryKind" USING "kind"::"CategoryKind";
ALTER TABLE "categories" ALTER COLUMN "kind" SET DEFAULT 'saida';
ALTER TABLE "chat_messages" ALTER COLUMN "role" SET DATA TYPE "ChatRole" USING "role"::"ChatRole";
ALTER TABLE "chat_messages" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "chat_messages" ALTER COLUMN "channel" SET DATA TYPE "ChatChannel" USING "channel"::"ChatChannel";
ALTER TABLE "chat_messages" ALTER COLUMN "channel" SET DEFAULT 'app';
ALTER TABLE "battles" ALTER COLUMN "kind" SET DATA TYPE "BattleKind" USING "kind"::"BattleKind";
ALTER TABLE "battles" ALTER COLUMN "status" SET DATA TYPE "BattleStatus" USING "status"::"BattleStatus";
ALTER TABLE "tostao_insights" ALTER COLUMN "severity" DROP DEFAULT;
ALTER TABLE "tostao_insights" ALTER COLUMN "severity" SET DATA TYPE "InsightSeverity" USING "severity"::"InsightSeverity";
ALTER TABLE "tostao_insights" ALTER COLUMN "severity" SET DEFAULT 'info';
ALTER TABLE "tostao_insights" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tostao_insights" ALTER COLUMN "status" SET DATA TYPE "InsightStatus" USING "status"::"InsightStatus";
ALTER TABLE "tostao_insights" ALTER COLUMN "status" SET DEFAULT 'PENDING';
