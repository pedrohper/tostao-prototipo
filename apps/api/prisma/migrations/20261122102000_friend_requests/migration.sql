-- Pedido de amizade com aceite. As amizades que já existem (tabela friendships) ficam como estão.
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "friend_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "addressee_id" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "friend_requests_not_self" CHECK ("requester_id" <> "addressee_id")
);

CREATE UNIQUE INDEX "friend_requests_requester_id_addressee_id_key" ON "friend_requests"("requester_id", "addressee_id");
CREATE INDEX "friend_requests_addressee_id_status_idx" ON "friend_requests"("addressee_id", "status");

ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
