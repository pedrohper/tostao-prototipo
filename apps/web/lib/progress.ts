'use client';
// ATALHO DO PROTÓTIPO: progresso das lições fica no localStorage do navegador.
// Na plataforma de verdade isso vira tabela no Postgres (LessonProgress) e endpoint na API.
const KEY = 'tostao:licoes-feitas';

export function getDone(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function markDone(id: string) {
  try {
    const done = new Set(getDone());
    done.add(id);
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch { /* navegador sem storage: segue sem salvar */ }
}
