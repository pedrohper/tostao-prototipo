// T5.3 · o que o Atalho do iOS manda vira valor, sinal e estabelecimento.
import { describe, expect, it } from 'vitest';
import type { ShortcutWebhookBody } from '@tostao/contracts';
import { parseShortcutPayload } from './shortcut-payload.js';

const body = (o: Partial<ShortcutWebhookBody>): ShortcutWebhookBody =>
  ({ source: 'apple_pay', ...o }) as ShortcutWebhookBody;

describe('valor', () => {
  it.each([
    [45.9, 45_90],
    ['R$ 45,90', 45_90],
    ['45.90', 45_90],
    ['1.234,56', 1234_56],
    [-45.9, 45_90], // o sinal do número é ignorado: quem decide é o `kind`
    ['-R$ 12,00', 12_00],
  ])('amount %j → %i centavos', (amount, cents) => {
    expect(parseShortcutPayload(body({ amount }))?.amountInCents).toBe(cents);
  });

  it('sem valor, valor zero, valor absurdo ou texto sem "R$": null (o servidor responde 400)', () => {
    expect(parseShortcutPayload(body({ text: 'Compra aprovada em PADARIA' }))).toBeNull();
    expect(parseShortcutPayload(body({ amount: 0 }))).toBeNull();
    expect(parseShortcutPayload(body({ amount: 'abc' }))).toBeNull();
    expect(parseShortcutPayload(body({ amount: 99_999_999_999 }))).toBeNull();
    expect(parseShortcutPayload(body({ amount: Number.NaN }))).toBeNull();
  });
});

describe('sinal (compra é saída por padrão)', () => {
  it('Apple Pay, notificação e atalho: saída; valor negativo também é saída', () => {
    expect(parseShortcutPayload(body({ amount: 10 }))?.kind).toBe('saida');
    expect(parseShortcutPayload(body({ amount: -10, source: 'ios_notification' }))?.kind).toBe('saida');
    expect(parseShortcutPayload(body({ amount: 10, source: 'shortcut' }))?.kind).toBe('saida');
  });
  it('texto de "recebido/estorno" vira entrada; `kind` explícito sempre vence', () => {
    expect(parseShortcutPayload(body({ text: 'Você recebeu um Pix de R$ 100,00 de João' }))?.kind).toBe('entrada');
    expect(parseShortcutPayload(body({ text: 'Estorno de R$ 20,00 na PADARIA' }))?.kind).toBe('entrada');
    expect(parseShortcutPayload(body({ amount: 10, kind: 'entrada' }))?.kind).toBe('entrada');
    expect(parseShortcutPayload(body({ text: 'Pix recebido R$ 5,00', kind: 'saida' }))?.kind).toBe('saida');
  });
});

describe('texto da notificação', () => {
  it('tira o valor e o estabelecimento ("... em PADARIA CENTRAL.")', () => {
    expect(parseShortcutPayload(body({ text: 'Compra aprovada R$ 45,90 em PADARIA CENTRAL.' }))).toEqual({
      kind: 'saida',
      amountInCents: 45_90,
      description: 'PADARIA CENTRAL',
    });
    expect(parseShortcutPayload(body({ text: 'Compra de R$ 1.200,00 no IFOOD' }))).toMatchObject({
      amountInCents: 1200_00,
      description: 'IFOOD',
    });
  });
  it('`merchant` explícito vence o texto; `amount` explícito vence o texto', () => {
    expect(
      parseShortcutPayload(body({ text: 'Compra R$ 99,00 em LOJA', merchant: 'Minha loja', amount: 10 })),
    ).toMatchObject({
      description: 'Minha loja',
      amountInCents: 10_00,
    });
  });
  it('sem estabelecimento: nome padrão da origem; descrição limitada a 140', () => {
    expect(parseShortcutPayload(body({ amount: 10 }))?.description).toBe('Apple Pay');
    expect(parseShortcutPayload(body({ amount: 10, source: 'ios_notification' }))?.description).toBe(
      'Notificação do banco',
    );
    expect(parseShortcutPayload(body({ amount: 10, source: 'shortcut' }))?.description).toBe('Atalho do iPhone');
    expect(parseShortcutPayload(body({ amount: 10, merchant: 'x'.repeat(300) }))?.description).toHaveLength(140);
  });
});
