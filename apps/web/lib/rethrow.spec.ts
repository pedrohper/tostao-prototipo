import { describe, expect, it } from 'vitest';
import { notFound, redirect } from 'next/navigation';
import { orFallback, rethrowIfRedirect } from './rethrow';

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('não lançou');
}

describe('rethrowIfRedirect', () => {
  it('relança NEXT_REDIRECT (redirect() dentro de try não pode ser engolido)', () => {
    const err = thrownBy(() => redirect('/entrar'));
    expect(String((err as { digest?: string }).digest)).toContain('NEXT_REDIRECT');
    expect(() => rethrowIfRedirect(err)).toThrow(err as Error);
  });

  it('relança notFound() também', () => {
    const err = thrownBy(() => notFound());
    expect(() => rethrowIfRedirect(err)).toThrow(err as Error);
  });

  it('erro comum passa batido (o catch segue e trata)', () => {
    expect(() => rethrowIfRedirect(new Error('API fora do ar'))).not.toThrow();
    expect(() => rethrowIfRedirect('string solta')).not.toThrow();
    expect(() => rethrowIfRedirect(undefined)).not.toThrow();
  });
});

describe('orFallback', () => {
  it('devolve o fallback em erro comum', async () => {
    await expect(Promise.reject(new Error('x')).catch(orFallback(42))).resolves.toBe(42);
    await expect(Promise.reject(new Error('x')).catch(orFallback(null))).resolves.toBeNull();
  });

  it('mas deixa o redirect passar em vez de trocá-lo por fallback', async () => {
    const err = thrownBy(() => redirect('/sair'));
    await expect(Promise.reject(err).catch(orFallback('fallback'))).rejects.toBe(err);
  });
});
