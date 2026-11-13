'use client';
import { useEffect, useState } from 'react';
import { setSons, sonsLigados, tocar, type Som } from '@/lib/sons';

/** Toque curtinho em botão e aba. Fica no layout do app. */
export function SonsDoToque() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button, nav a, [role="switch"]');
      if (el && !(el as HTMLButtonElement).disabled) tocar('toque');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
  return null;
}

/** Toca uma vez quando aparece (ex.: confete de lição concluída, meta batida). */
export function SomAoAparecer({ som }: { som: Som }) {
  useEffect(() => { tocar(som); }, [som]);
  return null;
}

/**
 * Comemora missão nova: compara com o que a pessoa já tinha visto hoje.
 * Primeira missão do dia = som da ofensiva; as outras = som de missão. Mostra um aviso curtinho.
 */
export function SomDasMissoes({ day, done, streak }: { day: string; done: number; streak: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const key = `tostao-missoes-${day}`;
    let before = -1;
    try { before = Number(localStorage.getItem(key) ?? '-1'); localStorage.setItem(key, String(done)); } catch { return; }
    if (before < 0 || done <= before) return;
    const first = before === 0;
    tocar(first ? 'ofensiva' : 'missao');
    setMsg(first ? `Ofensiva garantida: ${streak} ${streak === 1 ? 'dia' : 'dias'}!` : 'Missão feita!');
    const t = setTimeout(() => setMsg(null), 2800);
    return () => clearTimeout(t);
  }, [day, done, streak]);
  if (!msg) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-4 z-30 mx-auto w-fit rounded-full bg-tinta px-4 py-2 text-sm font-semibold text-papel shadow-lg">{msg}</div>
  );
}

/** Liga/desliga os sons no Perfil. */
export function SonsSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => setOn(sonsLigados()), []);
  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold">Sons</span>
        {on !== null && (
          <button type="button" role="switch" aria-checked={on} aria-label="Sons"
            onClick={() => { setSons(!on); setOn(!on); if (!on) setTimeout(() => tocar('moeda'), 0); }}
            className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${on ? 'bg-menta' : 'bg-papel-2 ring-1 ring-linha'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-cartao shadow transition-all ${on ? 'left-[24px]' : 'left-1'}`} />
          </button>
        )}
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">Toque nos botões, missão feita, ofensiva e meta batida. Seguem o volume de mídia do celular.</p>
    </section>
  );
}
