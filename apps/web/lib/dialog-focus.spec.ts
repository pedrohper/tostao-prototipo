// T2.4 · focus trap, Esc e scroll-lock dos diálogos (ConfirmDialog, StreakDialog, SwipeSheet). Lógica pura, sem DOM.
import { describe, expect, it, vi } from 'vitest';
import { createScrollLock, handleDialogKeydown, nextTrapIndex, type ContainerLike } from './dialog-focus';

describe('nextTrapIndex', () => {
  it('Tab avança e volta pro primeiro depois do último', () => {
    expect(nextTrapIndex(3, 0, false)).toBe(1);
    expect(nextTrapIndex(3, 1, false)).toBe(2);
    expect(nextTrapIndex(3, 2, false)).toBe(0);
  });
  it('Shift+Tab volta e pula do primeiro pro último', () => {
    expect(nextTrapIndex(3, 2, true)).toBe(1);
    expect(nextTrapIndex(3, 0, true)).toBe(2);
  });
  it('foco fora da lista (no painel): Tab vai pro primeiro, Shift+Tab pro último', () => {
    expect(nextTrapIndex(3, -1, false)).toBe(0);
    expect(nextTrapIndex(3, -1, true)).toBe(2);
  });
  it('sem nada focável devolve -1 (o foco fica no painel)', () => {
    expect(nextTrapIndex(0, -1, false)).toBe(-1);
    expect(nextTrapIndex(0, 0, true)).toBe(-1);
  });
});

describe('createScrollLock', () => {
  it('trava o overflow e devolve o valor original só quando o último diálogo fecha', () => {
    const body = { style: { overflow: 'auto' } };
    const lock = createScrollLock(body);
    lock.lock();
    expect(body.style.overflow).toBe('hidden');
    lock.lock(); // um diálogo sobre outro (ex.: ConfirmDialog sobre a folha)
    lock.unlock();
    expect(body.style.overflow).toBe('hidden');
    lock.unlock();
    expect(body.style.overflow).toBe('auto');
    expect(lock.count).toBe(0);
  });
  it('unlock a mais não quebra nem mexe no overflow', () => {
    const body = { style: { overflow: '' } };
    const lock = createScrollLock(body);
    lock.unlock();
    expect(body.style.overflow).toBe('');
  });
});

function fakeContainer(focusables: { focus: () => void; hidden?: boolean }[]) {
  const container = { focus: vi.fn(), querySelectorAll: () => focusables } satisfies ContainerLike;
  return container;
}
const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() });

describe('handleDialogKeydown', () => {
  it('Esc fecha o diálogo e não deixa o evento subir', () => {
    const onClose = vi.fn();
    const e = key('Escape');
    expect(handleDialogKeydown(e, fakeContainer([]), null, onClose)).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  it('Tab no último botão volta pro primeiro (o foco nunca escapa do diálogo)', () => {
    const a = { focus: vi.fn() };
    const b = { focus: vi.fn() };
    const e = key('Tab');
    handleDialogKeydown(e, fakeContainer([a, b]), b, vi.fn());
    expect(e.preventDefault).toHaveBeenCalled();
    expect(a.focus).toHaveBeenCalledOnce();
    expect(b.focus).not.toHaveBeenCalled();
  });

  it('Shift+Tab no primeiro vai pro último', () => {
    const a = { focus: vi.fn() };
    const b = { focus: vi.fn() };
    handleDialogKeydown(key('Tab', true), fakeContainer([a, b]), a, vi.fn());
    expect(b.focus).toHaveBeenCalledOnce();
  });

  it('ignora elementos escondidos e, sem focáveis, deixa o foco no painel', () => {
    const hidden = { focus: vi.fn(), hidden: true };
    const container = fakeContainer([hidden]);
    handleDialogKeydown(key('Tab'), container, null, vi.fn());
    expect(hidden.focus).not.toHaveBeenCalled();
    expect(container.focus).toHaveBeenCalledOnce();
  });

  it('outras teclas passam batido', () => {
    const e = key('a');
    expect(handleDialogKeydown(e, fakeContainer([]), null, vi.fn())).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
