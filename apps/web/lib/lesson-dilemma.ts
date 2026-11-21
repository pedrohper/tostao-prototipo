// Dilema da lição (T4.5). No conteúdo, `question` vem como "Opção A: ... vs. Opção B: ..." e as MESMAS frases estão
// em `optionA`/`optionB`: o player mostrava a pergunta E os botões, repetindo tudo. Aqui separamos o enunciado
// (se existir) das opções, que ficam só nos botões.

const OPTION_A = /Op[cç][aã]o\s*A\s*[:\-–]/i;

/** Texto que vem ANTES de "Opção A:" (enunciado de verdade), ou null quando a pergunta é só as duas opções. */
export function dilemmaLead(question: string): string | null {
  const m = OPTION_A.exec(question);
  const lead = (m ? question.slice(0, m.index) : question).trim();
  return lead || null;
}

/** Quando o conteúdo não traz `optionA`/`optionB`, tira de dentro da pergunta as duas frases. */
export function dilemmaOptions(d: { question: string; optionA?: string; optionB?: string }): { a: string; b: string } {
  if (d.optionA?.trim() && d.optionB?.trim()) return { a: d.optionA.trim(), b: d.optionB.trim() };
  const m = /Op[cç][aã]o\s*A\s*[:\-–]\s*(.*?)\s+vs\.?\s+Op[cç][aã]o\s*B\s*[:\-–]\s*(.*)$/is.exec(d.question);
  return {
    a: d.optionA?.trim() || m?.[1]?.trim() || '',
    b: d.optionB?.trim() || m?.[2]?.trim().replace(/\.$/, '') || '',
  };
}
