import { poupancaAnual, TAXAS_REFERENCIA, type TaxasResponse } from '@tostao/contracts';

export { TAXAS_REFERENCIA };

// Taxas de referência (Selic, CDI, IPCA) da API pública e gratuita do Banco Central (SGS), sem chave.
// Séries: 432 = meta Selic (% a.a.), 4389 = CDI anualizado base 252 (% a.a.), 13522 = IPCA acumulado em 12 meses (%).
export interface RatesGateway {
  taxas(): Promise<TaxasResponse>;
}


export class ReferenceRatesGateway implements RatesGateway {
  async taxas() {
    return TAXAS_REFERENCIA;
  }
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
const SGS = (serie: number) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;
const HORAS_12 = 12 * 3600_000;

/** "10/12/2025" -> "2025-12-10" */
const isoDate = (br: string) => br.split('/').reverse().join('-');

export class BcbRatesGateway implements RatesGateway {
  private cache: { at: number; value: TaxasResponse } | null = null;

  constructor(private readonly fetchFn: Fetch = fetch as unknown as Fetch, private readonly now: () => number = Date.now) {}

  private async serie(n: number): Promise<{ valor: number; data: string }> {
    const res = await this.fetchFn(SGS(n), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`SGS ${n} respondeu erro`);
    const body = (await res.json()) as { data: string; valor: string }[];
    const last = body.at(-1);
    const valor = Number(last?.valor);
    if (!last || !Number.isFinite(valor)) throw new Error(`SGS ${n} sem valor`);
    return { valor: valor / 100, data: isoDate(last.data) };
  }

  async taxas(): Promise<TaxasResponse> {
    if (this.cache && this.now() - this.cache.at < HORAS_12) return this.cache.value;
    try {
      const [selic, cdi, ipca] = await Promise.all([this.serie(432), this.serie(4389), this.serie(13522)]);
      const value: TaxasResponse = {
        selic: selic.valor,
        cdi: cdi.valor,
        ipca12m: ipca.valor,
        poupanca: poupancaAnual(selic.valor),
        atualizadoEm: [selic.data, cdi.data].sort().at(-1)!,
        fonte: 'bcb',
      };
      this.cache = { at: this.now(), value };
      return value;
    } catch (err) {
      console.error('[taxas] Banco Central não respondeu:', (err as Error).message);
      // Se já buscou antes, o valor velho é melhor que o de referência. Tenta de novo em 10 min.
      if (this.cache) {
        this.cache.at = this.now() - HORAS_12 + 10 * 60_000;
        return this.cache.value;
      }
      return TAXAS_REFERENCIA;
    }
  }
}
