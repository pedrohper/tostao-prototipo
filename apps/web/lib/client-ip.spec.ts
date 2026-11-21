import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';

const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;

describe('clientIpFromHeaders', () => {
  it('usa o ÚLTIMO item do X-Forwarded-For (o que o proxy da frente acrescentou), não o que o cliente escreveu', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.2.3.4, 100.64.0.7' }))).toBe('100.64.0.7');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': ' 10.0.0.1 ,  198.51.100.4 ' }))).toBe('198.51.100.4');
  });

  it('aceita IPv6', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('descarta lixo (nome, injeção, porta) e cai no X-Real-IP, ou em null', () => {
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'evil.example' }))).toBeNull();
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.2.3.4; DROP TABLE' }))).toBeNull();
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '1.2.3.4:8080' }))).toBeNull();
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': 'lixo', 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
    expect(clientIpFromHeaders(headers({}))).toBeNull();
    expect(clientIpFromHeaders(headers({ 'x-forwarded-for': '' }))).toBeNull();
  });
});

describe('forwardedForHeader', () => {
  it('monta o cabeçalho só quando há IP', () => {
    expect(forwardedForHeader('1.2.3.4')).toEqual({ 'x-forwarded-for': '1.2.3.4' });
    expect(forwardedForHeader(null)).toEqual({});
  });
});
