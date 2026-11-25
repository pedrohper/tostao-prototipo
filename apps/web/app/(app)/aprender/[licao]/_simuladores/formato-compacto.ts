import { money } from '@/lib/format';

/** Valores astronômicos por extenso ("R$ 1,99 milhão"); abaixo de um milhão, o dinheiro de sempre. Recebe reais. */
export function formatCompactMoney(reais: number): string {
  if (!Number.isFinite(reais) || reais >= 1e15) return 'R$ ∞ (astronômico)';
  const escala = (divisor: number, um: string, varios: string) => {
    const quanto = (reais / divisor).toFixed(2);
    return `R$ ${quanto.replace('.', ',')} ${Number(quanto) < 2 ? um : varios}`;
  };
  if (reais >= 1e12) return escala(1e12, 'trilhão', 'trilhões');
  if (reais >= 1e9) return escala(1e9, 'bilhão', 'bilhões');
  if (reais >= 1e6) return escala(1e6, 'milhão', 'milhões');
  return money(Math.round(reais * 100));
}
