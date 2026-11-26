'use client';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useDialogA11y } from '@/lib/use-dialog-a11y';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;

/**
 * Folha que fecha arrastando pra baixo pela alça (no mobile) e vira dialog centralizado no desktop (md+).
 * Passou de 30% da altura, ou foi um puxão rápido: fecha. Senão volta pro lugar.
 */
export function SwipeSheet({
  back,
  top,
  closeLabel = 'Fechar',
  children,
}: {
  back: string;
  top: number;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [panelHeight, setPanelHeight] = useState(600);
  const [solto, setSolto] = useState(true);
  const [closing, setClosing] = useState(false);
  // matchMedia só existe no navegador: ler no render dava HTML diferente no servidor e no cliente (hydration mismatch).
  // useSyncExternalStore usa `false` no servidor e na hidratação e só depois passa pro valor real (e acompanha mudanças).
  const reduz = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  const [labelId, setLabelId] = useState<string | undefined>(undefined);
  const headingId = useId();
  // O conteúdo da folha vem de fora: o primeiro título dele nomeia o diálogo (aria-labelledby).
  useEffect(() => {
    const heading = panel.current?.querySelector<HTMLElement>('h1, h2, h3');
    if (!heading) return;
    if (!heading.id) heading.id = headingId;
    setLabelId(heading.id);
  }, [headingId]);
  const measureHeight = () => panel.current?.offsetHeight ?? 600;

  const fechar = useCallback(() => {
    if (reduz) return router.push(back);
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    setSolto(true);
    if (isDesktop) {
      setClosing(true);
      setTimeout(() => router.push(back), 160);
    } else {
      const h = measureHeight();
      setPanelHeight(h);
      setDy(h);
      setTimeout(() => router.push(back), 200);
    }
  }, [back, reduz, router]);

  // Focus trap, Esc, scroll-lock e retorno do foco (a folha é uma rota: ao fechar o foco volta pra quem abriu).
  useDialogA11y({ open: true, containerRef: panel, onClose: fechar });

  const down = (e: React.PointerEvent) => {
    setPanelHeight(measureHeight());
    start.current = { y: e.clientY, t: performance.now() };
    setSolto(false);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDy(Math.max(0, e.clientY - start.current.y));
  };
  const up = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dist = Math.max(0, e.clientY - start.current.y);
    const vel = dist / Math.max(1, performance.now() - start.current.t);
    start.current = null;
    if (dist > measureHeight() * 0.3 || (vel > 0.8 && dist > 30)) fechar();
    else {
      setSolto(true);
      setDy(0);
    }
  };

  const anim = solto && !reduz ? 'transform 200ms cubic-bezier(.2,.8,.2,1), opacity 200ms' : 'none';
  const fade = closing ? 0 : Math.max(0, 1 - dy / panelHeight);

  return (
    <div className="fixed inset-x-0 top-0 z-30 flex h-dvh flex-col md:items-center md:justify-center md:p-6">
      <div
        aria-hidden="true"
        onClick={fechar}
        className="absolute inset-0 bg-tinta/45 md:bg-tinta/40 md:backdrop-blur-[2px] dark:bg-black/70"
        style={{ opacity: fade, transition: anim }}
      />
      <button
        type="button"
        aria-label={closeLabel}
        onClick={fechar}
        className="relative block shrink-0 md:hidden"
        style={{ height: top }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : closeLabel}
        tabIndex={-1}
        className="relative outline-none mx-auto flex w-full max-w-[520px] grow flex-col overflow-hidden rounded-t-[26px] bg-papel text-tinta md:m-auto md:max-h-[86dvh] md:w-full md:max-w-[540px] md:grow-0 md:rounded-[26px] md:border md:border-linha md:shadow-2xl"
        style={{
          transform: closing ? 'scale(0.97)' : dy > 0 ? `translateY(${dy}px)` : undefined,
          opacity: closing ? 0 : 1,
          transition: anim,
        }}
      >
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing md:hidden"
          aria-hidden="true"
        >
          <div className="h-[5px] w-10 rounded-full bg-linha" />
        </div>
        <div className="flex shrink-0 items-center justify-end px-4 pt-3.5 pb-0 max-md:hidden">
          <button
            type="button"
            onClick={fechar}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-full text-tinta-suave transition-colors hover:bg-papel-2 hover:text-tinta"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
