import { describe, expect, it, vi } from 'vitest';
import { BcbRatesGateway, TAXAS_REFERENCIA } from './rates-gateway.js';

const resposta = (valores: Record<number, { data: string; valor: string }>) =>
  vi.fn(async (url: string) => {
    const serie = Number(url.match(/sgs\.(\d+)/)![1]);
    return { ok: true, json: async () => [valores[serie]] };
  });

describe('taxas do Banco Central', () => {
  it('lê Selic, CDI e IPCA e calcula a poupança', async () => {
    const fetch = resposta({ 432: { data: '10/12/2025', valor: '15.00' }, 4389: { data: '12/12/2025', valor: '14.90' }, 13522: { data: '01/11/2025', valor: '4.68' } });
    const t = await new BcbRatesGateway(fetch).taxas();
    expect(t).toMatchObject({ atualizadoEm: '2025-12-12', fonte: 'bcb' });
    expect(t.selic).toBeCloseTo(0.15, 10);
    expect(t.cdi).toBeCloseTo(0.149, 10);
    expect(t.ipca12m).toBeCloseTo(0.0468, 10);
    expect(t.poupanca).toBeCloseTo(0.0617, 4);
  });

  it('guarda por 12 horas', async () => {
    let now = 0;
    const fetch = resposta({ 432: { data: '10/12/2025', valor: '15' }, 4389: { data: '10/12/2025', valor: '14.9' }, 13522: { data: '01/11/2025', valor: '4.6' } });
    const g = new BcbRatesGateway(fetch, () => now);
    await g.taxas();
    now = 11 * 3600_000;
    await g.taxas();
    expect(fetch).toHaveBeenCalledTimes(3);
    now = 13 * 3600_000;
    await g.taxas();
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it('se o Banco Central cai, usa a referência', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const g = new BcbRatesGateway(async () => ({ ok: false, json: async () => [] }));
    expect(await g.taxas()).toEqual(TAXAS_REFERENCIA);
  });
});
