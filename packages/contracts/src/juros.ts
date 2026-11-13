// Contas de juros usadas no app (simulador "Compensa parcelar?" e "Onde investir").
// Tudo em centavos e taxas em fração (0,15 = 15%). Funções puras: rodam no navegador e na API.

/** 15% ao ano -> taxa equivalente ao mês (juros compostos). */
export const anualParaMensal = (anual: number) => Math.pow(1 + anual, 1 / 12) - 1;
/** 2% ao mês -> taxa equivalente ao ano. */
export const mensalParaAnual = (mensal: number) => Math.pow(1 + mensal, 12) - 1;

/** Parcela fixa (tabela Price) de um empréstimo/financiamento. */
export function parcelaPrice(valorInCents: number, taxaMes: number, parcelas: number): number {
  if (parcelas <= 0) return 0;
  if (taxaMes <= 0) return Math.round(valorInCents / parcelas);
  const f = Math.pow(1 + taxaMes, parcelas);
  return Math.round((valorInCents * taxaMes * f) / (f - 1));
}

/** Valor presente de n parcelas iguais (a primeira daqui a 1 mês). */
const valorPresente = (parcela: number, taxaMes: number, n: number) =>
  taxaMes === 0 ? parcela * n : (parcela * (1 - Math.pow(1 + taxaMes, -n))) / taxaMes;

/**
 * Juros escondidos no parcelado: que taxa ao mês faz "n x parcela" valer o preço à vista hoje?
 * 0 se o parcelado sai pelo mesmo (ou menos) que à vista. Busca binária: sempre converge.
 */
export function taxaImplicita(aVistaInCents: number, parcelaInCents: number, parcelas: number, entradaInCents = 0): number {
  const financiado = aVistaInCents - entradaInCents;
  if (parcelas <= 0 || financiado <= 0 || parcelaInCents * parcelas <= financiado) return 0;
  let lo = 0;
  let hi = 1; // 100% ao mês: acima disso nem agiota
  if (valorPresente(parcelaInCents, hi, parcelas) > financiado) return hi;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (valorPresente(parcelaInCents, mid, parcelas) > financiado) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Alíquota de IR de renda fixa (tabela regressiva), pelo prazo em dias. */
export function aliquotaIR(dias: number): number {
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}

export type Rendimento = { brutoInCents: number; irInCents: number; liquidoInCents: number; finalInCents: number };

/** Quanto um valor rende em `meses`, com taxa ao ano. `isentoIR` para poupança, LCI e LCA. */
export function rendimento(valorInCents: number, taxaAnual: number, meses: number, isentoIR = false): Rendimento {
  const bruto = Math.round(valorInCents * (Math.pow(1 + taxaAnual, meses / 12) - 1));
  const ir = isentoIR || bruto <= 0 ? 0 : Math.round(bruto * aliquotaIR(Math.round(meses * 30.42)));
  return { brutoInCents: bruto, irInCents: ir, liquidoInCents: bruto - ir, finalInCents: valorInCents + bruto - ir };
}

/** Poupança (regra de 2012): Selic acima de 8,5% ao ano rende 0,5% ao mês; abaixo, 70% da Selic. TR fica de fora. */
export const poupancaAnual = (selicAnual: number) => (selicAnual > 0.085 ? mensalParaAnual(0.005) : selicAnual * 0.7);

export type CompraParcelada = {
  aVistaInCents: number;
  parcelaInCents: number;
  parcelas: number;
  /** Quanto rende o dinheiro guardado, ao ano (ex.: CDI). */
  rendeAnual: number;
};

export type VeredictoCompra = {
  totalParceladoInCents: number;
  /** Quanto o parcelado custa a mais que o à vista (0 se não custa). */
  jurosInCents: number;
  taxaMes: number;
  taxaAno: number;
  /**
   * Se você deixa o dinheiro do à vista rendendo e paga as parcelas com ele:
   * quanto sobra no fim (positivo) ou quanto faltou (negativo), comparado a pagar à vista.
   */
  saldoParcelandoInCents: number;
  melhor: 'a-vista' | 'parcelado' | 'empate';
};

/**
 * À vista ou parcelado? Compara pagar tudo hoje com deixar o dinheiro rendendo e tirar dele cada parcela.
 * O rendimento já sai líquido de IR (alíquota pelo prazo do parcelamento).
 */
export function compararCompra({ aVistaInCents, parcelaInCents, parcelas, rendeAnual }: CompraParcelada): VeredictoCompra {
  const total = parcelaInCents * parcelas;
  const taxaMes = taxaImplicita(aVistaInCents, parcelaInCents, parcelas);
  const rendeMes = anualParaMensal(rendeAnual) * (1 - aliquotaIR(Math.round(parcelas * 30.42)));
  let saldo = aVistaInCents;
  for (let i = 0; i < parcelas; i++) saldo = saldo * (1 + rendeMes) - parcelaInCents;
  const saldoInCents = Math.round(saldo);
  const margem = Math.max(100, Math.round(aVistaInCents * 0.002)); // diferença menor que R$ 1 (ou 0,2%) é empate
  return {
    totalParceladoInCents: total,
    jurosInCents: Math.max(0, total - aVistaInCents),
    taxaMes,
    taxaAno: mensalParaAnual(taxaMes),
    saldoParcelandoInCents: saldoInCents,
    melhor: Math.abs(saldoInCents) < margem ? 'empate' : saldoInCents > 0 ? 'parcelado' : 'a-vista',
  };
}

/** Quantos meses guardando `porMesInCents` (rendendo `rendeAnual`) até juntar `alvoInCents`. null se passa de 20 anos. */
export function mesesParaJuntar(alvoInCents: number, porMesInCents: number, rendeAnual: number, jaTemInCents = 0): number | null {
  if (jaTemInCents >= alvoInCents) return 0;
  if (porMesInCents <= 0) return null;
  const r = anualParaMensal(rendeAnual) * (1 - aliquotaIR(360));
  let saldo = jaTemInCents;
  for (let m = 1; m <= 240; m++) {
    saldo = saldo * (1 + r) + porMesInCents;
    if (saldo >= alvoInCents) return m;
  }
  return null;
}

/** Taxas de referência do Banco Central (ao ano, em fração). */
export type TaxasResponse = {
  selic: number;
  cdi: number;
  ipca12m: number;
  poupanca: number;
  /** Data da última leitura (YYYY-MM-DD). */
  atualizadoEm: string;
  /** "bcb" = buscado agora (com cache); "referencia" = o Banco Central não respondeu, valores guardados no app. */
  fonte: 'bcb' | 'referencia';
};

/** Usado quando o Banco Central não responde (e no simulador das lições). Última leitura conferida à mão. */
export const TAXAS_REFERENCIA: TaxasResponse = {
  selic: 0.15,
  cdi: 0.149,
  ipca12m: 0.045,
  poupanca: poupancaAnual(0.15),
  atualizadoEm: '2025-12-10',
  fonte: 'referencia',
};

/** 0.149 -> "14,9%" */
export const pct = (x: number, casas = 1) => `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
