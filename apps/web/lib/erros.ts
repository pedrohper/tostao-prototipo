// Erros que viajam na URL (?erro=...) são CÓDIGOS, nunca texto livre: quem monta o link não escolhe o que aparece
// no alerta (evita "Reflected Alert Spoofing", ex.: ?erro=Sua+conta+foi+bloqueada,+ligue+0800...).
export const ERROS = {
  nome_invalido: 'Diz o nome.',
  dados_invalidos: 'Confere os campos.',
  falha_salvar: 'Não consegui salvar agora. Tenta de novo.',
  nao_encontrado: 'Não encontrei isso. Pode ter sido apagado.',
  nota: 'Não consegui salvar a anotação. Tenta de novo.',
} as const;

export type ErroCodigo = keyof typeof ERROS;

/** Texto fixo do código, ou undefined se o valor da URL não é um código conhecido (ignorado em silêncio). */
export function erroDe(code: unknown): string | undefined {
  const raw = Array.isArray(code) ? code[0] : code;
  return typeof raw === 'string' && Object.hasOwn(ERROS, raw) ? ERROS[raw as ErroCodigo] : undefined;
}

/** Anexa ?erro=<código> (ou &erro=) a uma URL interna. */
export function comErro(url: string, code: ErroCodigo): string {
  return `${url}${url.includes('?') ? '&' : '?'}erro=${code}`;
}
