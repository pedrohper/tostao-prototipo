-- Um Item do Open Finance (Pluggy) só pode pertencer a UMA pessoa.
-- Itens internos ("import:..." e "manual:...") continuam por usuário, cobertos pelo @@unique([user_id, item_id]).
-- O Prisma não modela índice parcial: ele vive só aqui, no SQL.

-- Se já existir Item repetido, aborta com mensagem clara (resolver na mão antes de repetir o deploy).
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(item_id, ', ') INTO dup FROM (
    SELECT item_id FROM bank_connections
    WHERE item_id NOT LIKE 'import:%' AND item_id NOT LIKE 'manual:%'
    GROUP BY item_id HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'bank_connections tem item_id repetido entre usuários (%). Resolva antes de aplicar o índice único.', dup;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_connections_pluggy_item_id_key"
  ON "bank_connections" ("item_id")
  WHERE "item_id" NOT LIKE 'import:%' AND "item_id" NOT LIKE 'manual:%';
