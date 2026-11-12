-- CreateTable
CREATE TABLE "whatsapp_links" (
    "user_id" TEXT NOT NULL,
    "phone" TEXT,
    "code" TEXT,
    "code_expires_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3),

    CONSTRAINT "whatsapp_links_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_links_phone_key" ON "whatsapp_links"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_links_code_key" ON "whatsapp_links"("code");

-- AddForeignKey
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
