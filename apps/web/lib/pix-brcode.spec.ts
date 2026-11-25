// T6.16 · BR Code estático do Pix, conferido contra o exemplo do manual do Banco Central.
import { describe, expect, it } from 'vitest';
import { crc16, pixBrCode, pixChargeMessage, pixText } from './pix-brcode';

// Exemplo de QR Code estático do "Manual de Padrões para Iniciação do Pix" (BR Code): chave aleatória, sem valor.
const MANUAL_BC =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

/** Lê o código de volta em { id: valor } e confere se os tamanhos fecham. */
function parse(code: string) {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < code.length) {
    const id = code.slice(i, i + 2);
    const size = Number(code.slice(i + 2, i + 4));
    const value = code.slice(i + 4, i + 4 + size);
    expect(value).toHaveLength(size);
    fields[id] = value;
    i += 4 + size;
  }
  return fields;
}

describe('crc16 (CCITT-FALSE)', () => {
  it('bate com o valor de referência do algoritmo e com o exemplo do BC', () => {
    expect(crc16('123456789')).toBe('29B1');
    expect(crc16(MANUAL_BC.slice(0, -4))).toBe('1D3D');
    expect(crc16('')).toBe('FFFF');
  });
});

describe('pixBrCode', () => {
  it('reproduz o exemplo do manual do Banco Central, caractere por caractere', () => {
    expect(pixBrCode({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' })).toBe(
      MANUAL_BC,
    );
  });

  it('coloca o valor em reais com ponto e duas casas, e fecha o CRC', () => {
    const code = pixBrCode({ key: '+5511912345678', amountInCents: 123_405, name: 'Ana' });
    const f = parse(code);
    expect(f['54']).toBe('1234.05');
    expect(f['53']).toBe('986');
    expect(f['60']).toBe('BRASIL');
    expect(f['26']).toBe('0014br.gov.bcb.pix0114+5511912345678');
    expect(f['62']).toBe('0503***');
    expect(f['63']).toBe(crc16(code.slice(0, -4)));
    expect(parse(pixBrCode({ key: 'a@b.com', amountInCents: 5, name: 'Ana' }))['54']).toBe('0.05');
    expect(parse(pixBrCode({ key: 'a@b.com', amountInCents: 999_999_999_999, name: 'Ana' }))['54']).toBe(
      '9999999999.99',
    );
  });

  it('tira acento e emoji do nome e da cidade e corta em 25 e 15', () => {
    const f = parse(
      pixBrCode({
        key: 'a@b.com',
        name: 'João Antônio Conceição de Araújo 🐷 Júnior',
        city: 'São José dos Campos',
      }),
    );
    expect(f['59']).toBe('Joao Antonio Conceicao de');
    expect(f['59']!.length).toBeLessThanOrEqual(25);
    expect(f['60']).toBe('Sao Jose dos Ca');
    expect(pixText('🐷✨', 25, 'RECEBEDOR')).toBe('RECEBEDOR');
    expect(pixText("D'Ávila & Cia.", 25, 'x')).toBe('D Avila Cia.');
  });

  it('a maior chave possível (77) ainda cabe no campo 26', () => {
    const key = `${'a'.repeat(65)}@exemplo.com`;
    expect(key).toHaveLength(77);
    expect(parse(pixBrCode({ key, amountInCents: 100, name: 'Ana' }))['26']).toHaveLength(99);
  });

  it('recusa chave e valor fora do padrão', () => {
    expect(() => pixBrCode({ key: '', name: 'Ana' })).toThrow(RangeError);
    expect(() => pixBrCode({ key: 'a'.repeat(78), name: 'Ana' })).toThrow(RangeError);
    expect(() => pixBrCode({ key: 'joão@exemplo.com', name: 'Ana' })).toThrow(RangeError);
    for (const amountInCents of [0, -1, 10.5, 1_000_000_000_000, Number.NaN]) {
      expect(() => pixBrCode({ key: 'a@b.com', name: 'Ana', amountInCents })).toThrow(RangeError);
    }
  });
});

describe('pixChargeMessage', () => {
  it('diz o valor e avisa que o código vem em seguida, sem levar a chave junto', () => {
    const text = pixChargeMessage('Bia', 'R$ 25,00');
    expect(text).toContain('Oi, Bia!');
    expect(text).toContain('R$ 25,00');
    expect(text).toContain('copia e cola');
    expect(text).not.toContain('br.gov.bcb.pix');
  });
});
