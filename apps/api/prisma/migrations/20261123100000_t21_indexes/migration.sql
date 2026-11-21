-- T2.1 · Índices em FKs e colunas de filtro (sem full table scan) + índices parciais e busca por trigrama.
-- Sem CONCURRENTLY de propósito: o Prisma roda a migration numa transação e CREATE INDEX CONCURRENTLY não pode.
-- As tabelas são pequenas; o custo é um lock de escrita curto durante cada CREATE INDEX.


CREATE INDEX "accounts_connection_id_idx" ON "accounts"("connection_id");

CREATE INDEX "bank_connections_status_idx" ON "bank_connections"("status");

CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

CREATE INDEX "category_budgets_category_id_idx" ON "category_budgets"("category_id");

CREATE INDEX "category_rules_category_id_idx" ON "category_rules"("category_id");

CREATE INDEX "chat_messages_user_id_role_created_at_idx" ON "chat_messages"("user_id", "role", "created_at");

CREATE INDEX "friendships_friend_id_idx" ON "friendships"("friend_id");

CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

CREATE INDEX "password_resets_expires_at_idx" ON "password_resets"("expires_at");

CREATE INDEX "sent_notifications_sent_at_idx" ON "sent_notifications"("sent_at");

CREATE INDEX "tostao_insights_expires_at_idx" ON "tostao_insights"("expires_at");

CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

CREATE INDEX "transactions_user_id_account_id_occurred_at_idx" ON "transactions"("user_id", "account_id", "occurred_at");

CREATE INDEX "transactions_user_id_person_id_occurred_at_idx" ON "transactions"("user_id", "person_id", "occurred_at");

CREATE INDEX "transactions_user_id_series_id_occurred_at_idx" ON "transactions"("user_id", "series_id", "occurred_at");

-- Os índices abaixo o Prisma não modela (parcial e GIN com operator class): ficam só aqui, como o item_id parcial de
-- bank_connections (20261120120000) e os únicos case-insensitive (20261121103000). O `migrate diff` ignora os dois.

-- Fila de "sem categoria" (auto-categorizar, contagem do Início): só as linhas pendentes, na ordem de uso.
CREATE INDEX "transactions_uncategorized_idx" ON "transactions"("user_id", "occurred_at")
  WHERE "category_id" IS NULL AND "is_internal_transfer" = false;

-- Lançamentos anotados na mão (conciliação, /anotacoes): external_id nulo.
CREATE INDEX "transactions_manual_idx" ON "transactions"("user_id", "occurred_at")
  WHERE "external_id" IS NULL;

-- Busca por trecho da descrição (ILIKE '%ifood%') da busca da carteira.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "transactions_description_trgm_idx" ON "transactions" USING GIN ("description" gin_trgm_ops);
