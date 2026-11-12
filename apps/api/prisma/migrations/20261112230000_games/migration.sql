-- Tribunal do Tostão e Batalhas
CREATE TABLE "tribunal_votes" (
    "user_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "voted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tribunal_votes_pkey" PRIMARY KEY ("user_id","case_id")
);
CREATE INDEX "tribunal_votes_case_id_idx" ON "tribunal_votes"("case_id");
ALTER TABLE "tribunal_votes" ADD CONSTRAINT "tribunal_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "battles" (
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "battles_pkey" PRIMARY KEY ("user_id","kind")
);
ALTER TABLE "battles" ADD CONSTRAINT "battles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
