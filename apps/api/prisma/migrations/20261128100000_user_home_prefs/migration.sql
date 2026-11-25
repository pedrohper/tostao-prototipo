-- T6.11: preferências da Home na conta (blocos, ordem e avisos fechados). Aditiva: coluna nula, sem default e sem backfill.
ALTER TABLE "users" ADD COLUMN "home_prefs" JSONB;
