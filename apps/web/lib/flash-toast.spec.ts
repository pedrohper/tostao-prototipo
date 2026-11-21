// T4.1 · toast que sobrevive ao redirect() de uma Server Action (cookie curto lido pelo ToastProvider).
// O cookie é editável pelo usuário: tudo que vem dele passa por validação antes de virar toast ou "Desfazer".
import { describe, expect, it } from 'vitest';
import { encodeFlash, FLASH_COOKIE, parseFlash, parseFlashUndo, readFlashCookie } from './flash-toast';

describe('encodeFlash() / parseFlash()', () => {
  it('ida e volta preserva mensagem, variante e "desfazer"', () => {
    const flash = {
      message: 'Categoria salva.',
      variant: 'success' as const,
      undo: { kind: 'categorize' as const, id: 'tx_123', categoryId: 'delivery' },
    };
    expect(parseFlash(encodeFlash(flash))).toEqual(flash);
  });

  it('o valor codificado cabe num cookie (sem ; , espaço ou aspas soltos)', () => {
    expect(encodeFlash({ message: 'Gasto anotado; ok, "beleza"', variant: 'info' })).not.toMatch(/[;,\s"]/);
  });

  it('mensagem enorme é cortada', () => {
    const parsed = parseFlash(encodeFlash({ message: 'x'.repeat(1000), variant: 'info' }));
    expect(parsed?.message.length).toBeLessThanOrEqual(160);
  });

  it.each([
    ['vazio', ''],
    ['null', null],
    ['lixo', '%%%nao-e-json'],
    ['JSON que não é objeto', encodeURIComponent('"oi"')],
    ['sem mensagem', encodeURIComponent(JSON.stringify({ variant: 'success' }))],
    ['mensagem em branco', encodeURIComponent(JSON.stringify({ message: '   ', variant: 'success' }))],
    ['variante inventada', encodeURIComponent(JSON.stringify({ message: 'oi', variant: 'danger' }))],
  ])('cookie inválido (%s) vira null', (_n, raw) => {
    expect(parseFlash(raw as string | null)).toBeNull();
  });

  it('"desfazer" malicioso é descartado, mas o aviso em si continua valendo', () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        message: 'Categoria salva.',
        variant: 'success',
        undo: { kind: 'categorize', id: '../../sair', categoryId: 'delivery' },
      }),
    );
    expect(parseFlash(raw)).toEqual({ message: 'Categoria salva.', variant: 'success' });
  });
});

describe('parseFlashUndo()', () => {
  it('aceita só o formato conhecido', () => {
    expect(parseFlashUndo({ kind: 'categorize', id: 'a1', categoryId: 'b2' })).toEqual({
      kind: 'categorize',
      id: 'a1',
      categoryId: 'b2',
    });
  });

  it.each([
    [null],
    ['categorize'],
    [{ kind: 'delete-everything', id: 'a1', categoryId: 'b2' }],
    [{ kind: 'categorize', id: 'a1' }],
    [{ kind: 'categorize', id: 'a/b', categoryId: 'b2' }],
    [{ kind: 'categorize', id: 'a1', categoryId: '../b2' }],
    [{ kind: 'categorize', id: 'a'.repeat(65), categoryId: 'b2' }],
  ])('rejeita %j', (raw) => {
    expect(parseFlashUndo(raw)).toBeNull();
  });
});

describe('readFlashCookie()', () => {
  it('acha o cookie no meio de vários', () => {
    expect(readFlashCookie(`a=1; ${FLASH_COOKIE}=abc%7Bx; b=2`)).toBe('abc%7Bx');
  });

  it('sem o cookie (ou com valor vazio) devolve null', () => {
    expect(readFlashCookie('a=1; b=2')).toBeNull();
    expect(readFlashCookie(`${FLASH_COOKIE}=`)).toBeNull();
    expect(readFlashCookie('')).toBeNull();
  });

  it('não confunde com cookie de nome parecido', () => {
    expect(readFlashCookie(`${FLASH_COOKIE}-x=1`)).toBeNull();
  });
});
