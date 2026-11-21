// T1.5 · conciliação: só apaga anotação quando é a MESMA cobrança, com certeza.
import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/entities.js';
import { descriptionsLookAlike, findManualDuplicates } from './reconcile-manual.js';

const D = new Date('2026-11-10T15:00:00Z');
let n = 0;
const t = (o: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  userId: 'u1',
  accountId: null,
  externalId: null,
  description: 'X',
  amountInCents: -1000,
  occurredAt: D,
  categoryId: null,
  isInternalTransfer: false,
  seriesId: null,
  createdAt: D,
  ...o,
});

describe('conciliação de anotações', () => {
  it('par seguro: 1 anotação (dinheiro vivo) ↔ 1 cobrança, com descrição forte (2 palavras)', () => {
    const manual = t({ description: 'Spotify Premium' });
    const bank = t({ description: 'SPOTIFY PREMIUM BR', externalId: 'e1', accountId: 'A' });
    expect(findManualDuplicates([manual, bank]).matched).toEqual([{ manual, bank }]);
  });

  it('anotação numa conta ESPECÍFICA só confirma cobrança da MESMA conta', () => {
    const manual = t({ description: 'Netflix Brasil', accountId: 'A' });
    const outraConta = t({ description: 'NETFLIX BRASIL', externalId: 'e1', accountId: 'B' });
    expect(findManualDuplicates([manual, outraConta]).matched).toHaveLength(0);
    const mesmaConta = t({ description: 'NETFLIX BRASIL', externalId: 'e2', accountId: 'A' });
    expect(findManualDuplicates([manual, mesmaConta]).matched).toHaveLength(1);
  });

  it('dinheiro vivo com uma palavra genérica só NÃO apaga gasto real', () => {
    for (const generic of ['Mercado', 'Casa', 'Loja', 'Pago', 'Pix']) {
      const manual = t({ description: generic });
      const bank = t({ description: `${generic.toUpperCase()} DO BAIRRO`, externalId: 'e1', accountId: 'A' });
      expect(findManualDuplicates([manual, bank]).matched, generic).toHaveLength(0);
    }
  });

  it('uma palavra só vale se tiver mais de 5 letras e não for genérica ("Netflix" sim, "Uber" não)', () => {
    expect(descriptionsLookAlike('Netflix', 'NETFLIX.COM')).toBe(true);
    expect(descriptionsLookAlike('Uber', 'UBER *TRIP')).toBe(false);
  });

  it('transferência interna do banco não confirma anotação (não é gasto)', () => {
    const manual = t({ description: 'Pagamento fatura cartão' });
    const bank = t({
      description: 'PAGAMENTO FATURA CARTAO',
      externalId: 'e1',
      accountId: 'A',
      isInternalTransfer: true,
    });
    expect(findManualDuplicates([manual, bank]).matched).toHaveLength(0);
  });

  it('ambíguo (2 cobranças iguais) continua não apagando nada', () => {
    const manual = t({ description: 'Spotify Premium' });
    const b1 = t({ description: 'SPOTIFY PREMIUM', externalId: 'e1', accountId: 'A' });
    const b2 = t({ description: 'SPOTIFY PREMIUM', externalId: 'e2', accountId: 'B' });
    const r = findManualDuplicates([manual, b1, b2]);
    expect(r.matched).toHaveLength(0);
    expect(r.ambiguous).toEqual([manual]);
  });
});
