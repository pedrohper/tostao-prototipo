-- T5.3: tokens de automação (Atalhos do iOS → POST /webhooks/shortcuts). Só o hash SHA-256 é guardado.
CREATE TABLE "automation_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "automation_tokens_label_len_chk" CHECK (char_length("label") BETWEEN 1 AND 60)
);

CREATE UNIQUE INDEX "automation_tokens_token_hash_key" ON "automation_tokens"("token_hash");
CREATE INDEX "automation_tokens_user_id_idx" ON "automation_tokens"("user_id");

ALTER TABLE "automation_tokens" ADD CONSTRAINT "automation_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
