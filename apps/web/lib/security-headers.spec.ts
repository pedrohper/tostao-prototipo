import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders } from './security-headers';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(' ') ?? [];

describe('CSP do site', () => {
  const prod = buildCsp({ isProd: true });

  it('trava o que não precisa: sem plugin, sem moldura em outro site, base fixa, default só do próprio site', () => {
    expect(directive(prod, 'default-src')).toEqual(["'self'"]);
    expect(directive(prod, 'object-src')).toEqual(["'none'"]);
    expect(directive(prod, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(prod, 'base-uri')).toEqual(["'self'"]);
    expect(directive(prod, 'worker-src')).toEqual(["'self'"]);
  });

  it('libera o Pluggy Connect (SDK em cdn.pluggy.ai, janela em connect.pluggy.ai) e mais nenhum terceiro', () => {
    expect(directive(prod, 'script-src')).toContain('https://cdn.pluggy.ai');
    expect(directive(prod, 'frame-src')).toContain('https://connect.pluggy.ai');
    expect(directive(prod, 'connect-src')).toContain('https://api.pluggy.ai');
    const hosts = [...prod.matchAll(/https?:\/\/[^\s;]+/g)].map((m) => m[0]);
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.every((h) => h.includes('pluggy.ai'))).toBe(true);
  });

  it("'unsafe-eval' e websockets só no dev; em produção não", () => {
    expect(directive(prod, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(prod, 'connect-src')).not.toContain('ws:');
    const dev = buildCsp({ isProd: false });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
  });

  it("script-src NÃO aceita '*', http: nem data: (só inline do Next, o próprio site e o Pluggy)", () => {
    for (const bad of ['*', 'http:', 'data:', 'https:']) expect(directive(prod, 'script-src')).not.toContain(bad);
  });
});

describe('securityHeaders', () => {
  const map = (isProd: boolean) => Object.fromEntries(securityHeaders({ isProd }).map((h) => [h.key, h.value]));

  it('manda os cabeçalhos pedidos', () => {
    const h = map(true);
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(h['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('HSTS só em produção', () => {
    expect(map(true)['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(map(false)['Strict-Transport-Security']).toBeUndefined();
  });
});
