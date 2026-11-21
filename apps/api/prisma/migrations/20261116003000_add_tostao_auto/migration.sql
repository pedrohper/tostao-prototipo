-- CreateTable
CREATE TABLE "tostao_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "routine" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acted_at" TIMESTAMP(3),

    CONSTRAINT "tostao_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tostao_auto_configs" (
    "user_id" TEXT NOT NULL,
    "caramelo_extrato" BOOLEAN NOT NULL DEFAULT true,
    "tostao_previsao" BOOLEAN NOT NULL DEFAULT true,
    "guardiao_limites" BOOLEAN NOT NULL DEFAULT true,
    "olheiro_acertos" BOOLEAN NOT NULL DEFAULT true,
    "notify_push" BOOLEAN NOT NULL DEFAULT true,
    "notify_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "last_checked_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tostao_auto_configs_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "tostao_insights_user_id_status_created_at_idx" ON "tostao_insights"("user_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tostao_insights_user_id_dedupe_key_key" ON "tostao_insights"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "tostao_insights" ADD CONSTRAINT "tostao_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tostao_auto_configs" ADD CONSTRAINT "tostao_auto_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

