// Web Push: o endpoint vem do navegador do usuário e o servidor faz um POST nele.
// Sem trava, dava pra cadastrar http://127.0.0.1:3334/... ou o IP de metadata da nuvem e usar a API como proxy interno (SSRF).
// Só passam os serviços de push oficiais, em https, sem porta nem credencial na URL.

const EXACT_HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
// Sufixos com ponto na frente: "evilpush.apple.com" não casa com ".push.apple.com".
const HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'];

export function isAllowedPushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('.')) return false;
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}
