// Período da planilha (CSV) em /mais. A API já aceita `from` e `to` (dias civis); aqui só se escolhe qual.
import { shiftMonth, todayIso } from './format';

export const PERIODOS_CSV = [
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes-passado', rotulo: 'Mês passado' },
  { id: 'ano', rotulo: 'Este ano' },
] as const;

export type PeriodoCsv = (typeof PERIODOS_CSV)[number]['id'];

const mesInteiro = (month: string) => {
  const [ano, mes] = month.split('-').map(Number);
  // Dia 0 do mês seguinte = último dia deste.
  const ultimo = new Date(Date.UTC(ano!, mes!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(ultimo).padStart(2, '0')}` };
};

/** O endereço do download. "Tudo" não manda data nenhuma: vai o histórico inteiro. */
export function urlDoCsv(periodo: PeriodoCsv, hoje: string = todayIso()): string {
  const base = '/api/me/export.csv';
  if (periodo === 'tudo') return base;
  const mes = hoje.slice(0, 7);
  const { from, to } =
    periodo === 'ano'
      ? { from: `${hoje.slice(0, 4)}-01-01`, to: `${hoje.slice(0, 4)}-12-31` }
      : mesInteiro(periodo === 'mes' ? mes : shiftMonth(mes, -1));
  return `${base}?${new URLSearchParams({ from, to })}`;
}
