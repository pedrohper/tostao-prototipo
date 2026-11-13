import type { BankGateway, InstitutionLogo } from '../gateways/bank-gateway.js';

const TTL_MS = 24 * 60 * 60 * 1000;

/** Logos dos bancos, guardados por um dia (a lista quase nunca muda). Se o provedor falhar, devolve o que tiver (ou nada). */
export class InstitutionLogosUseCase {
  private cache: { at: number; logos: InstitutionLogo[] } | null = null;
  constructor(private readonly bank: Pick<BankGateway, 'listInstitutionLogos'>, private readonly now: () => number = Date.now) {}

  async execute(): Promise<{ logos: InstitutionLogo[] }> {
    if (this.cache && this.now() - this.cache.at < TTL_MS) return { logos: this.cache.logos };
    try {
      const logos = await this.bank.listInstitutionLogos();
      this.cache = { at: this.now(), logos };
      return { logos };
    } catch {
      return { logos: this.cache?.logos ?? [] };
    }
  }
}
