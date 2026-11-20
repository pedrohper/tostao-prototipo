-- O código de vínculo do WhatsApp deixa de ser guardado em texto claro: só o SHA-256 (code_hash).
-- Códigos pendentes (validade de minutos) são descartados; números já vinculados (phone) continuam.
DROP INDEX IF EXISTS "whatsapp_links_code_key";
ALTER TABLE "whatsapp_links" DROP COLUMN "code";
ALTER TABLE "whatsapp_links" ADD COLUMN "code_hash" TEXT;
CREATE UNIQUE INDEX "whatsapp_links_code_hash_key" ON "whatsapp_links"("code_hash");
-- Sem código, a validade não faz sentido.
UPDATE "whatsapp_links" SET "code_expires_at" = NULL;
