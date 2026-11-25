// INSS e IRRF mensais dos simuladores do módulo 6, pelas regras de 2026. Conferir todo mês de janeiro.
// INSS: Portaria Interministerial MPS/MF nº 13, de 09/01/2026 (cada faixa paga a própria alíquota, até o teto).
// IRRF: tabela mensal de 2026 e redução da Lei 15.270/2025, em gov.br/receitafederal, "Tributação de 2026".
// Simplificação: sem dependentes, pensão alimentícia ou previdência privada.

/** [teto da faixa em reais, alíquota] */
const FAIXAS_INSS: [number, number][] = [
  [1621.0, 0.075],
  [2902.84, 0.09],
  [4354.27, 0.12],
  [8475.55, 0.14],
];

/** [teto da base em reais, alíquota, parcela a deduzir] */
const FAIXAS_IRRF: [number, number, number][] = [
  [2428.8, 0, 0],
  [2826.65, 0.075, 182.16],
  [3751.05, 0.15, 394.16],
  [4664.68, 0.225, 675.49],
  [Infinity, 0.275, 908.73],
];

const DESCONTO_SIMPLIFICADO = 607.2;

export function calcInssCents(brutoCents: number): number {
  const bruto = brutoCents / 100;
  let anterior = 0;
  let total = 0;
  for (const [teto, aliq] of FAIXAS_INSS) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, teto) - anterior;
    total += base * aliq;
    anterior = teto;
  }
  return Math.round(total * 100);
}

/** Redução da Lei 15.270/2025. Usa o salário bruto (não a base de cálculo): zera o imposto até R$ 5.000. */
function reducaoDoIrrf(bruto: number): number {
  if (bruto <= 5000) return 312.89;
  if (bruto <= 7350) return 978.62 - 0.133145 * bruto;
  return 0;
}

export function calcIrrfCents(brutoCents: number, inssCents: number): number {
  const bruto = brutoCents / 100;
  // Vale o que for maior: o desconto simplificado ou o INSS pago.
  const base = Math.max(0, bruto - Math.max(inssCents / 100, DESCONTO_SIMPLIFICADO));
  const [, aliq, parcela] = FAIXAS_IRRF.find(([teto]) => base <= teto)!;
  return Math.max(0, Math.round((base * aliq - parcela - reducaoDoIrrf(bruto)) * 100));
}
