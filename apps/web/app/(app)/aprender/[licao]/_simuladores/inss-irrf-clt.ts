// INSS e IRRF (simplificados) dos simuladores do módulo 6. Cópia sem mudança das contas que estavam em
// simulators-m6-m9.tsx (T6.15): a tabela é a mesma de antes.

export function calcInssCents(brutoCents: number): number {
  const bruto = brutoCents / 100;
  const faixas: [number, number][] = [
    [1518.0, 0.075],
    [2793.88, 0.09],
    [4190.83, 0.12],
    [8157.41, 0.14],
  ];
  let anterior = 0;
  let total = 0;
  for (const [teto, aliq] of faixas) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, teto) - anterior;
    total += base * aliq;
    anterior = teto;
  }
  return Math.round(total * 100);
}

export function calcIrrfCents(brutoCents: number, inssCents: number): number {
  const bruto = brutoCents / 100;
  const inss = inssCents / 100;
  // Desconto simplificado mensal (R$ 564,80) vs INSS legal: usa o maior
  const deducao = Math.max(inss, 564.8);
  const base = Math.max(0, bruto - deducao);
  let ir: number;
  if (base <= 2259.2) ir = 0;
  else if (base <= 2826.65) ir = base * 0.075 - 169.44;
  else if (base <= 3751.05) ir = base * 0.15 - 381.44;
  else if (base <= 4664.68) ir = base * 0.225 - 662.77;
  else ir = base * 0.275 - 896.0;
  return Math.max(0, Math.round(ir * 100));
}
