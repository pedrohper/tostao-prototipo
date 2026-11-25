// GET /me/export.csv (T6.21): período opcional, em dias civis da pessoa. Sem `from`/`to`, vai o histórico inteiro.
import { z } from 'zod';

const civilDay = z.preprocess(
  (v) => (v === '' ? undefined : v), // formulário manda o campo vazio
  z
    .string()
    .regex(/^(19|2\d)\d{2}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD')
    // 31/02 passaria na regex; ida e volta pelo calendário pega.
    .refine((d) => {
      const date = new Date(`${d}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(d);
    }, 'Essa data não existe')
    .optional(),
);

export const exportCsvQuery = z
  .object({ from: civilDay, to: civilDay })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'A data inicial precisa vir antes da final' });
export type ExportCsvQuery = z.infer<typeof exportCsvQuery>;
