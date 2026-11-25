-- T6.16: chave Pix opcional da pessoa (já normalizada). Aditiva: coluna nula, sem default e sem backfill.
ALTER TABLE "users" ADD COLUMN "pix_key" TEXT;
