import { describe, expect, it } from 'vitest';
import { linkOptions, type LinkAccount } from './transfer-link-options';

const bank = (id: string): LinkAccount => ({ id, name: id, type: 'BANK' });
const card = (id: string): LinkAccount => ({ id, name: id, type: 'CREDIT' });
const all = [bank('conta'), bank('poupanca'), card('visa'), card('master')];

describe('linkOptions', () => {
  it('lançamento numa CONTA: fatura → cartões; transferência → outras contas (nunca a própria nem cartão)', () => {
    const o = linkOptions(bank('conta'), all);
    expect(o.cardPayment.map((a) => a.id)).toEqual(['visa', 'master']);
    expect(o.transfer.map((a) => a.id)).toEqual(['poupanca']);
  });
  it('lançamento no CARTÃO (ex.: "pagamento recebido"): fatura → quem pagou (conta); transferência não existe', () => {
    const o = linkOptions(card('visa'), all);
    expect(o.cardPayment.map((a) => a.id)).toEqual(['conta', 'poupanca']);
    expect(o.transfer).toEqual([]);
  });
  it('dinheiro (sem conta): pode pagar fatura ou transferir pra qualquer conta', () => {
    const o = linkOptions(null, all);
    expect(o.cardPayment.map((a) => a.id)).toEqual(['visa', 'master']);
    expect(o.transfer.map((a) => a.id)).toEqual(['conta', 'poupanca']);
  });
  it('sem outras contas: nada a mostrar', () => {
    expect(linkOptions(bank('conta'), [bank('conta')])).toEqual({ cardPayment: [], transfer: [] });
  });
});
