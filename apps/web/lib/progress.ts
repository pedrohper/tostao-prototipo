'use client';
// Progresso das lições agora fica no servidor (tabela lesson_progress).
// Aqui só sobrou a leitura do que a versão antiga guardava no navegador, pra migrar uma vez.
const KEY = 'tostao:licoes-feitas';

export function takeLegacyDone(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    localStorage.removeItem(KEY);
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
