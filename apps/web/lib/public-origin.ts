// Origem pública do site (pra montar o redirect depois de um POST). Atrás do proxy reverso (tailscale serve, Coolify...)
// a URL do pedido é a interna (localhost): o certo é `APP_PUBLIC_URL`, ou o Host que o proxy repassa.
export function publicOrigin(headers: Headers, appPublicUrl?: string): string {
  if (appPublicUrl) {
    try {
      return new URL(appPublicUrl).origin;
    } catch {
      // APP_PUBLIC_URL inválida: cai pro cabeçalho
    }
  }
  const host = headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host')?.trim() || 'localhost';
  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'http' ? 'http' : 'https';
  // Host só com caracteres de host de verdade (nada de caminho, @ ou espaço: o redirect nunca sai pra outro lugar).
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return 'https://localhost';
  return `${host.startsWith('localhost') || host.startsWith('127.') ? 'http' : proto}://${host}`;
}
