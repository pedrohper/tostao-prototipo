-- O voto do Tribunal passa a valer por semana: o mesmo caso pode voltar e a pessoa vota de novo.
-- week_key = segunda-feira (Brasília) da semana em que o voto foi dado. date_trunc('week') do Postgres começa na segunda.
ALTER TABLE "tribunal_votes" ADD COLUMN "week_key" TEXT;
UPDATE "tribunal_votes"
SET "week_key" = to_char(date_trunc('week', "voted_at" AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM "tribunal_votes" WHERE "week_key" IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'tribunal_votes: % linha(s) sem week_key após o backfill', n; END IF;
  SELECT count(*) INTO n FROM (SELECT 1 FROM "tribunal_votes" GROUP BY "user_id", "case_id", "week_key" HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION 'tribunal_votes: % voto(s) repetido(s) na mesma semana', n; END IF;
END $$;

ALTER TABLE "tribunal_votes" ALTER COLUMN "week_key" SET NOT NULL;
ALTER TABLE "tribunal_votes" DROP CONSTRAINT "tribunal_votes_pkey";
ALTER TABLE "tribunal_votes" ADD CONSTRAINT "tribunal_votes_pkey" PRIMARY KEY ("user_id", "case_id", "week_key");
