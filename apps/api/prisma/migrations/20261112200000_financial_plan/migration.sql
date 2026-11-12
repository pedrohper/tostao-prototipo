-- CreateTable
CREATE TABLE "financial_plans" (
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_plans_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "financial_plans" ADD CONSTRAINT "financial_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
