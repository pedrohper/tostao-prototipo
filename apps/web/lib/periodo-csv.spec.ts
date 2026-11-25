// Período da planilha: os endereços pedidos à API.
import { describe, expect, it } from 'vitest';
import { PERIODOS_CSV, urlDoCsv } from './periodo-csv';

const periodo = (id: (typeof PERIODOS_CSV)[number]['id'], hoje: string) => {
  const url = new URL(urlDoCsv(id, hoje), 'http://x');
  return [url.searchParams.get('from'), url.searchParams.get('to')];
};

describe('urlDoCsv', () => {
  it('"Tudo" não manda data', () => {
    expect(urlDoCsv('tudo', '2026-11-25')).toBe('/api/me/export.csv');
  });

  it('este mês, mês passado e este ano, com o mês inteiro', () => {
    expect(periodo('mes', '2026-11-25')).toEqual(['2026-11-01', '2026-11-30']);
    expect(periodo('mes-passado', '2026-11-25')).toEqual(['2026-10-01', '2026-10-31']);
    expect(periodo('ano', '2026-11-25')).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('virada de ano e fevereiro bissexto', () => {
    expect(periodo('mes-passado', '2027-01-03')).toEqual(['2026-12-01', '2026-12-31']);
    expect(periodo('mes', '2028-02-10')).toEqual(['2028-02-01', '2028-02-29']);
    expect(periodo('mes-passado', '2027-03-31')).toEqual(['2027-02-01', '2027-02-28']);
  });
});
