/** Razão da falha ao tentar ligar o banco pelo widget. */
export type WidgetFailureReason = 'token' | 'init' | 'widget' | 'connect';

const TECHNICAL_PATTERNS = [
  /item\s*id/i,
  /\bpluggy\b|pluggy\s*connect/i,
  /client\s*user\s*id/i,
  /connect[_\s-]*token/i,
  /\bsdk\b/i,
  /\b(?:400|401|403|404|409|422|429|500|502|503|504)\b/,
  /network\s*error|failed to fetch|econnrefused|timeout/i,
];

/**
 * Converte qualquer erro do fluxo do widget (token, SDK, onError ou vinculação) em mensagem
 * humana no tom do Tostão, sem vazar Item ID, código HTTP ou detalhe técnico pro usuário comum.
 */
export function humanizeWidgetError(rawError?: string | null, reason: WidgetFailureReason = 'widget'): string {
  const msg = (rawError ?? '').trim();

  if (reason === 'connect') {
    if (/não está disponível|não pertence|conflit|forbidden/i.test(msg)) {
      return 'Esse banco já tá ligado ou pertence a outra conta. Tenta de novo pelo botão acima, ou traz seus gastos de outro jeito:';
    }
    if (/só de teste|sandbox/i.test(msg)) {
      return 'Esse é um banco só de teste. Escolhe o seu banco de verdade no MeuPluggy, ou traz seus gastos de outro jeito:';
    }
  }

  return 'Não deu pra conectar seu banco agora. O Open Finance pode estar instável ou o acesso ainda não ficou pronto — mas dá pra continuar de outro jeito:';
}

/** Garante em testes que nenhum termo técnico ou código HTTP escape na mensagem exibida. */
export function hasTechnicalLeak(text: string): boolean {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}
