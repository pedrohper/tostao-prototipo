// Defesas contra Open Redirect e Path Traversal. Tudo que vem de FormData, searchParams ou params e vira
// redirect() ou parte de uma URL da API interna passa por aqui. Funções puras: sem Next, testáveis com vitest.

const BASE = 'https://tostao.local';
// Rotas que um redirect vindo do usuário nunca deve alcançar (/sair desloga; /api/* são handlers, não telas).
const BLOCKED_PREFIXES = ['/sair', '/api'];

function isBlocked(pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true; // percent-encoding inválido: melhor não seguir
  }
  return [pathname, decoded].some((p) => {
    const lower = p.toLowerCase();
    return BLOCKED_PREFIXES.some((b) => lower === b || lower.startsWith(`${b}/`) || lower.startsWith(`${b}?`));
  });
}

/**
 * Só devolve `raw` se for um caminho interno seguro ("/carteira?mes=2026-11"); senão, `fallback`.
 * Rejeita: vazio, sem "/" inicial, "//host", "\" (o browser trata como "/"), caracteres de controle,
 * qualquer coisa que o `new URL` resolva pra outra origem, e rotas sensíveis (/sair, /api/*).
 */
export function safeInternalPath(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || raw === '') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  // eslint-disable-next-line no-control-regex -- barrar caractere de controle é justamente o objetivo
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (isBlocked(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export class InvalidPathSegmentError extends Error {
  constructor() {
    super('Identificador inválido.');
    this.name = 'InvalidPathSegmentError';
  }
}

const SEGMENT = /^[a-zA-Z0-9_-]{1,64}$/;

/** true se `id` serve como um segmento de caminho (UUID ou slug). Pra páginas decidirem `notFound()`. */
export function isSafePathSegment(id: unknown): id is string {
  return typeof id === 'string' && SEGMENT.test(id);
}

/**
 * Valida um id (UUID/slug: letras, números, "_" e "-", até 64) antes de interpolar numa URL da API interna,
 * e devolve já com encodeURIComponent. Lança InvalidPathSegmentError em "../x", "a?b=1", "a/b", ".." etc.
 */
export function safePathSegment(id: unknown): string {
  if (!isSafePathSegment(id)) throw new InvalidPathSegmentError();
  return encodeURIComponent(id);
}
