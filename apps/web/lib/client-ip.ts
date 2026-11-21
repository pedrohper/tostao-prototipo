import { isIP } from 'node:net';

// IP real de quem está no navegador, pra API aplicar os limites de requisição por IP.
// O site fica atrás de um proxy reverso (HTTPS), que ACRESCENTA o IP de quem conectou no fim do X-Forwarded-For. Por isso
// vale o ÚLTIMO item: o que vem antes foi escrito por quem fez a requisição e não merece confiança.
// A API só aceita esse valor vindo da própria máquina (TRUST_PROXY=loopback).

// IPv4 ou IPv6 puros (sem porta nem zona); qualquer outra coisa é descartada.
const isIpAddress = (value: string) => isIP(value) !== 0;

export function clientIpFromHeaders(get: (name: string) => string | null | undefined): string | null {
  const forwarded = get('x-forwarded-for');
  const last = forwarded?.split(',').at(-1)?.trim();
  if (last && isIpAddress(last)) return last;
  const real = get('x-real-ip')?.trim();
  return real && isIpAddress(real) ? real : null;
}

/** Cabeçalho pra mandar à API junto com a requisição (vazio se o IP não é conhecido). */
export function forwardedForHeader(ip: string | null): Record<string, string> {
  return ip ? { 'x-forwarded-for': ip } : {};
}
