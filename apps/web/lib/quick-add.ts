// Peças puras do "Anotar rápido" (T4.4): chips de data (Hoje/Ontem), sugestões de descrição e os passos do formulário.

/** AAAA-MM-DD somando `delta` dias (aritmética de calendário em UTC: sem fuso, sem horário de verão). */
export function shiftDay(iso: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
  return d.toISOString().slice(0, 10);
}

export type DateChip = 'hoje' | 'ontem' | 'outra';

/** Qual chip está ativo pra data escolhida (`today` vem do servidor, pra não divergir do fuso da pessoa). */
export function dateChip(selected: string, today: string): DateChip {
  if (selected === today) return 'hoje';
  if (selected === shiftDay(today, -1)) return 'ontem';
  return 'outra';
}

export function dateForChip(chip: 'hoje' | 'ontem', today: string): string {
  return chip === 'hoje' ? today : shiftDay(today, -1);
}

export type RecentTx = {
  description: string;
  occurredAt: string;
  source?: 'bank' | 'manual';
  customDescription?: string | null;
  personId?: string | null;
  isInternalTransfer?: boolean;
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * As últimas descrições que a PESSOA escreveu (anotações à mão, ou o apelido que deu): do mais recente pro mais antigo,
 * sem repetir (ignora caixa e acento). Descrição de banco ("PIX ENVIADO 123..."), acerto com alguém e transferência
 * entre contas não servem de sugestão para "O que foi".
 */
export function recentDescriptions(txs: RecentTx[], limit = 8): string[] {
  const sorted = [...txs].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of sorted) {
    if (t.personId || t.isInternalTransfer) continue;
    const text = (t.customDescription?.trim() || (t.source === 'bank' ? '' : t.description)).trim();
    if (!text || text.length > 60) continue;
    const key = norm(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** Sugestões enquanto digita: começa com o texto vem antes de "contém"; o que já está igual ao digitado sai. */
export function suggestDescriptions(recents: string[], query: string, limit = 4): string[] {
  const q = norm(query);
  if (!q) return recents.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const r of recents) {
    const n = norm(r);
    if (n === q) continue;
    if (n.startsWith(q)) starts.push(r);
    else if (n.includes(q)) contains.push(r);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Formulário pronto pra salvar? (valor > 0 e descrição preenchida) */
export function canSaveQuickAdd(input: { cents: number | null; description: string }): boolean {
  return (input.cents ?? 0) > 0 && input.description.trim().length > 0;
}
