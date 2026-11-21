-- T4.4: apelido amigável do lançamento. Coluna nova, nula por padrão: nada muda para o que já existe.
-- A descrição original (`description`) continua intacta (conciliação, regras de categoria e busca dependem dela).
ALTER TABLE "transactions" ADD COLUMN "custom_description" TEXT;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_custom_description_len_chk"
  CHECK ("custom_description" IS NULL OR (char_length("custom_description") BETWEEN 1 AND 80));
