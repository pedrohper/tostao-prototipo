-- Gastos anotados que repetem (todo mês) ou parcelados: as próximas ocorrências compartilham o series_id.
ALTER TABLE "transactions" ADD COLUMN "series_id" TEXT;
CREATE INDEX "transactions_series_id_idx" ON "transactions"("series_id");
