'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Folha que fecha arrastando pra baixo pela alça (ou pelo topo).
 * Passou de 30% da altura, ou foi um puxão rápido: fecha. Senão volta pro lugar.
 */
export function SwipeSheet({ back, top, children }: { back: string; top: number; children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [solto, setSolto] = useState(true);
  const reduz = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const altura = () => panel.current?.offsetHeight ?? 600;
  const fechar = () => {
    if (reduz) return router.push(back);
    setSolto(true);
    setDy(altura());
    setTimeout(() => router.push(back), 200);
  };
  const down = (e: React.PointerEvent) => {
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
    if (dist > altura() * 0.3 || (vel > 0.8 && dist > 30)) fechar();
    else { setSolto(true); setDy(0); }
  };
  const anim = solto && !reduz ? 'transform 200ms cubic-bezier(.2,.8,.2,1), opacity 200ms' : 'none';
  const fade = Math.max(0, 1 - dy / altura());
  return (
    <div className="fixed inset-0 z-30 flex flex-col">
      <div aria-hidden="true" className="absolute inset-0 bg-[#8E8780] dark:bg-black/70" style={{ opacity: fade, transition: anim }} />
      <button type="button" aria-label="Fechar" onClick={fechar} className="relative block shrink-0" style={{ height: top }} />
      <div ref={panel} className="relative mx-auto flex w-full max-w-[520px] grow flex-col overflow-hidden rounded-t-[26px] bg-papel text-tinta"
        style={{ transform: `translateY(${dy}px)`, transition: anim }}>
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing" aria-hidden="true">
          <div className="h-[5px] w-10 rounded-full bg-linha" />
        </div>
        <div className="flex grow flex-col gap-3.5 overflow-y-auto px-5 pb-7">{children}</div>
      </div>
    </div>
  );
}
