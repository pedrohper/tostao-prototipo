// Máscara de valor do "Anotar" (T4.4). Funciona como app de banco: a pessoa digita só números e eles entram como
// centavos ("1" → 0,01 · "12" → 0,12 · "1250" → 12,50 · "123456" → 1.234,56). O texto formatado sai no padrão que
// `parseMoney` (lib/format.ts, o mesmo do servidor) lê sem ambiguidade.
import { parseMoney } from './format';

/** Mesmo teto do contrato (MAX_CENTS = R$ 100 milhões): acima disso o último dígito digitado é ignorado. */
export const MAX_MASK_CENTS = 10_000_000_000;

/** Só dígitos, sem zeros à esquerda; vazio vira ''. */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/** Cents → "1.234,56" (sem "R$": o prefixo já está na tela). 0 ou inválido → ''. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return '';
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  return `${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${frac}`;
}

/** O que o `onChange` do campo grava: dígitos digitados (ou colados) viram centavos formatados. */
export function maskMoneyInput(raw: string): string {
  let digits = digitsOnly(raw);
  while (digits.length > 0 && Number(digits) > MAX_MASK_CENTS) digits = digits.slice(0, -1);
  return digits === '' ? '' : formatCents(Number(digits));
}

/** Valor do campo mascarado em centavos (null se vazio/zero). É o que a validação do formulário usa. */
export function centsFromMasked(masked: string): number | null {
  const cents = parseMoney(masked);
  return cents !== null && cents > 0 ? cents : null;
}

/**
 * Texto COLADO ("R$ 12,50", "12.5", "1.234,56", "12"): aqui o valor já vem com intenção. Com vírgula/ponto decimal é
 * decimal; só dígitos é em reais inteiros ("12" = R$ 12,00, não 0,12). Ambíguo ("1,500", "1.5000") → '' (limpa).
 */
export function maskPastedMoney(text: string): string {
  const cleaned = text.replace(/R\$/gi, '').trim();
  if (/^\d+$/.test(cleaned)) {
    const cents = Number(cleaned) * 100;
    return cents > MAX_MASK_CENTS ? '' : formatCents(cents);
  }
  const cents = parseMoney(cleaned);
  return cents !== null && cents > 0 && cents <= MAX_MASK_CENTS ? formatCents(cents) : '';
}
