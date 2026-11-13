'use client';
import { useEffect, useState } from 'react';
import { apagarInscricao, salvarInscricao } from '@/lib/push-actions';

const toKey = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type Estado = 'carregando' | 'sem-suporte' | 'desligado' | 'ligado' | 'bloqueado' | 'servidor-off';

/** Liga/desliga os avisos neste celular: contas a vencer, ofensiva em risco e resumo da semana. */
export function Avisos({ publicKey }: { publicKey: string | null }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setEstado('servidor-off');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setEstado('sem-suporte');
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? 'ligado' : 'desligado');
    })().catch(() => setEstado('sem-suporte'));
  }, [publicKey]);

  async function ligar() {
    if (!publicKey) return;
    setOcupado(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setEstado(perm === 'denied' ? 'bloqueado' : 'desligado'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }));
      const r = await salvarInscricao(sub.toJSON());
      setEstado(r.ok ? 'ligado' : 'desligado');
    } catch {
      setEstado('desligado');
    } finally { setOcupado(false); }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await apagarInscricao(sub.endpoint); await sub.unsubscribe(); }
      setEstado('desligado');
    } finally { setOcupado(false); }
  }

  const texto: Record<Estado, string> = {
    carregando: 'Conferindo…',
    'sem-suporte': 'Esse navegador não recebe avisos. No iPhone, adiciona o Tostão à tela de início primeiro.',
    desligado: 'Fatura e conta 2 dias antes de vencer, ofensiva em risco às 20h e o resumo da semana no domingo.',
    ligado: 'Ligados neste celular. Fatura e conta 2 dias antes, ofensiva às 20h, resumo no domingo.',
    bloqueado: 'Os avisos tão bloqueados pro Tostão. Libera nas configurações do navegador e volta aqui.',
    'servidor-off': 'Os avisos ainda não tão ligados no servidor. Já já.',
  };
  return (
    <section id="avisos" className="flex scroll-mt-4 flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold">Avisos no celular</span>
        {(estado === 'desligado' || estado === 'ligado') && (
          <button type="button" role="switch" aria-checked={estado === 'ligado'} disabled={ocupado} onClick={estado === 'ligado' ? desligar : ligar}
            aria-label="Avisos no celular"
            className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${estado === 'ligado' ? 'bg-menta' : 'bg-papel-2 ring-1 ring-linha'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-cartao shadow transition-all ${estado === 'ligado' ? 'left-[24px]' : 'left-1'}`} />
          </button>
        )}
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">{texto[estado]}</p>
    </section>
  );
}
