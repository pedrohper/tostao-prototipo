// T5.3 · Share Target do Android: o que o PWA recebe quando a pessoa "compartilha" o extrato do app do banco com o Tostão.
// Funções puras (sem Next) pra testar sem subir nada.

export type SharedKind = 'pdf' | 'statement' | 'image' | 'unsupported';

/** 10 MB, o mesmo teto do /importar. */
export const SHARE_MAX_BYTES = 10 * 1024 * 1024;

const EXT = (name: string) => /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? '';

/**
 * O app do banco às vezes manda o MIME errado (`application/octet-stream`), então vale o MIME OU a extensão.
 * Quem decide de verdade é a API (magic bytes `%PDF-`, parser de OFX/CSV): isto só escolhe o caminho da tela.
 */
export function classifySharedFile(file: { name: string; type: string }): SharedKind {
  const type = file.type.toLowerCase();
  const ext = EXT(file.name);
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (
    ['ofx', 'csv', 'txt'].includes(ext) ||
    ['text/csv', 'application/x-ofx', 'application/ofx', 'text/plain'].includes(type)
  )
    return 'statement';
  return 'unsupported';
}

/**
 * Anti-CSRF do POST do compartilhamento. O navegador manda `Sec-Fetch-Site: none` quando o próprio sistema inicia
 * (compartilhar do Android) e `same-origin` quando vem do site. `cross-site` e `same-site` (outro site/subdomínio
 * mandando um <form>) são barrados. Navegador sem o cabeçalho cai na checagem do `Origin`, se houver.
 * Mesmo passando, nada é importado sem a pessoa confirmar na tela, e o cookie é SameSite=Lax.
 */
export function isTrustedShareRequest(headers: Headers, ownHosts: (string | null | undefined)[]): boolean {
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'none' || site === 'same-origin';
  const origin = headers.get('origin');
  if (!origin) return true; // compartilhamento do sistema sem Origin nem Sec-Fetch-Site (navegadores antigos)
  if (origin === 'null') return false;
  try {
    const host = new URL(origin).host;
    return ownHosts.some((h) => h && h === host);
  } catch {
    return false;
  }
}

/** Nome seguro pra mostrar (sem caminho, sem caracteres de controle, tamanho limitado). */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex -- tirar caractere de controle é o objetivo
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
  return (base || 'arquivo').slice(0, 120);
}
