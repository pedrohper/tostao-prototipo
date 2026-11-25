// BR Code estático do Pix ("copia e cola"), no padrão EMV de QR Code do Banco Central. Puro, sem dependência.
// Cada campo é: ID (2 dígitos) + tamanho (2 dígitos) + valor. O último (63) é o CRC16/CCITT-FALSE de tudo que
// veio antes, incluindo o próprio "6304". A chave é dado pessoal: nada aqui escreve em log.

/** Limites do padrão: nome e cidade de quem recebe, e o campo do valor (13 caracteres, com o ponto). */
const NAME_MAX = 25;
const CITY_MAX = 15;
const KEY_MAX = 77;
const AMOUNT_MAX_CENTS = 999_999_999_999;
/** O app não pergunta a cidade (o campo é obrigatório no padrão, mas é só informativo pra quem paga). */
export const PIX_DEFAULT_CITY = 'BRASIL';

/** CRC16/CCITT-FALSE: polinômio 0x1021, começa em 0xFFFF, sem reflexão e sem XOR final. 4 hexadecimais. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nome/cidade: sem acento, só o que todo banco aceita, cortado no limite. Vazio (ex.: só emoji) usa o reserva. */
export function pixText(raw: string, max: number, fallback: string): string {
  const clean = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9 .-]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return clean || fallback;
}

function field(id: string, value: string): string {
  if (value.length > 99) throw new RangeError(`Campo ${id} do BR Code passou de 99 caracteres`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export function pixBrCode({
  key,
  amountInCents,
  name,
  city = PIX_DEFAULT_CITY,
}: {
  key: string;
  /** Sem valor, quem paga digita o quanto quer. */
  amountInCents?: number;
  name: string;
  city?: string;
}): string {
  // A chave chega normalizada da API; aqui só garantimos que cabe no padrão (ASCII visível, até 77).
  if (key.length > KEY_MAX || !/^[\x21-\x7e]+$/.test(key)) throw new RangeError('Chave Pix inválida pro BR Code');
  if (
    amountInCents !== undefined &&
    (!Number.isInteger(amountInCents) || amountInCents <= 0 || amountInCents > AMOUNT_MAX_CENTS)
  )
    throw new RangeError('Valor inválido pro BR Code');
  const amount =
    amountInCents === undefined
      ? ''
      : field('54', `${Math.floor(amountInCents / 100)}.${String(amountInCents % 100).padStart(2, '0')}`);
  const payload = [
    field('00', '01'),
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)),
    field('52', '0000'), // categoria do comerciante: não informada
    field('53', '986'), // real
    amount,
    field('58', 'BR'),
    field('59', pixText(name, NAME_MAX, 'RECEBEDOR')),
    field('60', pixText(city, CITY_MAX, PIX_DEFAULT_CITY)),
    field('62', field('05', '***')), // QR estático sem identificador
    '6304',
  ].join('');
  return payload + crc16(payload);
}

/** Mensagem do "Cobrar", no tom do Tostão: direta, leve e sem climão. O código vai numa mensagem à parte. */
export function pixChargeMessage(personName: string, amountText: string): string {
  return [
    `Oi, ${personName}! Passando pra gente acertar: ficou ${amountText}.`,
    'Já te mando o Pix copia e cola aqui embaixo. É só colar no app do banco, no "Pix copia e cola".',
    'Sem pressa e sem climão 🐷',
  ].join('\n');
}
