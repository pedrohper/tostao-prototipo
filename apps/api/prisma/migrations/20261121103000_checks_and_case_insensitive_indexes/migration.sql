-- CHECK constraints e índices únicos case-insensitive. O Prisma não modela nenhum dos dois: ficam só aqui
-- (prisma migrate diff ignora e não os derruba). Pré-checagem aborta com mensagem clara se existir dado fora da regra.

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "category_budgets" WHERE "limit_in_cents" <= 0;
  IF n > 0 THEN RAISE EXCEPTION 'category_budgets: % linha(s) com limit_in_cents <= 0', n; END IF;
  SELECT count(*) INTO n FROM "transactions" WHERE "amount_in_cents" = 0;
  IF n > 0 THEN RAISE EXCEPTION 'transactions: % linha(s) com amount_in_cents = 0', n; END IF;
  SELECT count(*) INTO n FROM "friendships" WHERE "user_id" = "friend_id";
  IF n > 0 THEN RAISE EXCEPTION 'friendships: % linha(s) com user_id = friend_id', n; END IF;
  SELECT count(*) INTO n FROM "tribunal_votes" WHERE "choice" < 0;
  IF n > 0 THEN RAISE EXCEPTION 'tribunal_votes: % linha(s) com choice < 0', n; END IF;

  SELECT count(*) INTO n FROM (SELECT 1 FROM "users" GROUP BY lower("email") HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'users: % e-mail(s) repetido(s) ignorando maiúsculas', n; END IF;
  SELECT count(*) INTO n FROM (SELECT 1 FROM "people" GROUP BY "user_id", lower("name") HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'people: % nome(s) repetido(s) por pessoa ignorando maiúsculas', n; END IF;
  SELECT count(*) INTO n FROM (SELECT 1 FROM "categories" GROUP BY COALESCE("user_id", ''), lower("name") HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'categories: % nome(s) repetido(s) por dono ignorando maiúsculas', n; END IF;
  SELECT count(*) INTO n FROM (SELECT 1 FROM "category_rules" GROUP BY "user_id", "pattern" HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'category_rules: % padrão(ões) repetido(s) por dono (inclui regras do sistema)', n; END IF;
END $$;

ALTER TABLE "category_budgets" ADD CONSTRAINT "category_budgets_limit_positive" CHECK ("limit_in_cents" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_nonzero" CHECK ("amount_in_cents" <> 0);
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_not_self" CHECK ("user_id" <> "friend_id");
ALTER TABLE "tribunal_votes" ADD CONSTRAINT "tribunal_votes_choice_nonnegative" CHECK ("choice" >= 0);

CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));
CREATE UNIQUE INDEX "people_user_id_name_lower_key" ON "people" ("user_id", lower("name"));
CREATE UNIQUE INDEX "categories_owner_name_lower_key" ON "categories" (COALESCE("user_id", ''), lower("name"));
-- Regras do sistema têm user_id NULL: o UNIQUE normal trata NULL como diferente e deixaria duplicar. PG 15+.
CREATE UNIQUE INDEX "category_rules_user_pattern_nn_key" ON "category_rules" ("user_id", "pattern") NULLS NOT DISTINCT;
