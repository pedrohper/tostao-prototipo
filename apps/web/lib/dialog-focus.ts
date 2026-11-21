// Regras puras de foco e de rolagem dos diálogos (focus trap, scroll-lock). Sem DOM aqui: dá pra testar sem navegador.

/** Tudo que o teclado alcança dentro de um diálogo. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Pra onde vai o foco no Tab / Shift+Tab dentro do diálogo (circular).
 * `current` é o índice do elemento focado na lista de focáveis, ou -1 se o foco está fora dela (ex.: no próprio painel).
 * Devolve -1 quando não há nada focável (o foco fica no painel).
 */
export function nextTrapIndex(total: number, current: number, shift: boolean): number {
  if (total <= 0) return -1;
  if (current < 0) return shift ? total - 1 : 0;
  if (shift) return current === 0 ? total - 1 : current - 1;
  return current === total - 1 ? 0 : current + 1;
}

type ScrollTarget = { style: { overflow: string } };

/**
 * Trava a rolagem do `body` enquanto houver algum diálogo aberto. Contador: dois diálogos empilhados
 * (ex.: ConfirmDialog sobre uma folha) só liberam a rolagem quando o último fecha, e o valor original volta intacto.
 */
export function createScrollLock(target: ScrollTarget) {
  let locks = 0;
  let original = '';
  return {
    lock() {
      if (locks === 0) {
        original = target.style.overflow;
        target.style.overflow = 'hidden';
      }
      locks += 1;
    },
    unlock() {
      if (locks === 0) return;
      locks -= 1;
      if (locks === 0) target.style.overflow = original;
    },
    get count() {
      return locks;
    },
  };
}

/** O mínimo que o handler precisa de um elemento (HTMLElement satisfaz; nos testes é um objeto de mentira). */
export type FocusableLike = { focus: () => void; hidden?: boolean };
export type ContainerLike = FocusableLike & { querySelectorAll: (selector: string) => ArrayLike<FocusableLike> };
export type KeyLike = { key: string; shiftKey: boolean; preventDefault: () => void; stopPropagation: () => void };

/**
 * Teclado do diálogo: Esc fecha; Tab / Shift+Tab circulam só entre os focáveis do painel (focus trap).
 * Sem nenhum focável, o foco fica no próprio painel. Devolve true se tratou a tecla.
 */
export function handleDialogKeydown(
  e: KeyLike,
  container: ContainerLike,
  active: unknown,
  onClose: () => void,
): boolean {
  if (e.key === 'Escape') {
    e.stopPropagation();
    onClose();
    return true;
  }
  if (e.key !== 'Tab') return false;
  const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.hidden);
  const next = nextTrapIndex(list.length, list.indexOf(active as FocusableLike), e.shiftKey);
  e.preventDefault();
  (next === -1 ? container : list[next]!).focus();
  return true;
}
