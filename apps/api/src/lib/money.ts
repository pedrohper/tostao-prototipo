// Dinheiro no banco é BIGINT (centavos); no app inteiro é `number`. Esta é a ÚNICA ponte entre os dois:
// os repositórios do Prisma chamam estas funções na leitura e na escrita, e o resto do código nem vê o bigint.
// Seguro até Number.MAX_SAFE_INTEGER (~90 trilhões de reais em centavos); o teto de negócio (R$ 100 milhões)
// é imposto nos contratos (Zod). Passou disso, falha alto em vez de arredondar em silêncio.

export function toCents(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Valor em centavos fora da faixa segura do JavaScript');
  }
  return Number(value);
}

export function toCentsOrNull(value: bigint | null): number | null {
  return value === null ? null : toCents(value);
}

export function toBigCents(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError('Valor em centavos precisa ser um inteiro seguro');
  return BigInt(value);
}
