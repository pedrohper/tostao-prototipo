-- CreateTable
CREATE TABLE "ignored_subscriptions" (
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "ignored_subscriptions_pkey" PRIMARY KEY ("user_id","key")
);

-- AddForeignKey
ALTER TABLE "ignored_subscriptions" ADD CONSTRAINT "ignored_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
