'use client';
// Acessibilidade de diálogo num lugar só: foco inicial, focus trap (Tab/Shift+Tab), Esc, retorno do foco
// pra quem abriu e bloqueio da rolagem do body. Usado por ConfirmDialog, StreakDialog e SwipeSheet.
import { useEffect, useRef, type RefObject } from 'react';
import { FOCUSABLE_SELECTOR, createScrollLock, handleDialogKeydown } from './dialog-focus';

let scrollLock: ReturnType<typeof createScrollLock> | null = null;
function getScrollLock() {
  if (!scrollLock && typeof document !== 'undefined') scrollLock = createScrollLock(document.body);
  return scrollLock;
}

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => !el.hidden);
}

export function useDialogA11y({
  open,
  containerRef,
  onClose,
  initialFocusRef,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Quem recebe o foco ao abrir (título ou botão fechar). Sem isso: o primeiro focável, ou o próprio painel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  // O onClose costuma mudar a cada render: num ref pra não refazer o trap (e perder o foco) à toa.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const lock = getScrollLock();
    lock?.lock();

    const container = containerRef.current;
    const first = initialFocusRef?.current ?? (container ? focusables(container)[0] : null) ?? container;
    first?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (containerRef.current) handleDialogKeydown(e, containerRef.current, document.activeElement, closeRef.current);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lock?.unlock();
      // Devolve o foco a quem abriu (se ainda estiver na página).
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, containerRef, initialFocusRef]);
}
