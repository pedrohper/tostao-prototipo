-- Aviso diário "quanto posso gastar hoje": aditiva e desligada por padrão.
ALTER TABLE "tostao_auto_configs" ADD COLUMN "notify_safe_to_spend" BOOLEAN NOT NULL DEFAULT false;
