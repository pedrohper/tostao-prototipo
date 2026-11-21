'use client';
import { useEffect, useState } from 'react';
import { deletePushSubscription, savePushSubscription } from '@/lib/push-actions';
import { getDictionary, type Locale } from '@/lib/i18n';

const urlBase64ToUint8Array = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type PushStatus = 'loading' | 'unsupported' | 'disabled' | 'enabled' | 'blocked' | 'serverOff';

/** Toggles web push notifications on this device (upcoming bills, streak reminders, weekly summary). */
export function PushNotificationCard({
  publicKey,
  locale = 'pt-BR',
  embedded = false,
}: {
  publicKey: string | null;
  locale?: Locale;
  embedded?: boolean;
}) {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const t = getDictionary(locale);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setStatus('serverOff');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setStatus('unsupported');
      }
      if (Notification.permission === 'denied') return setStatus('blocked');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? 'enabled' : 'disabled');
    })().catch(() => setStatus('unsupported'));
  }, [publicKey]);

  async function enablePush() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'blocked' : 'disabled');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const res = await savePushSubscription(subscription.toJSON());
      setStatus(res.ok ? 'enabled' : 'disabled');
    } catch {
      setStatus('disabled');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('disabled');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="avisos"
      className={
        embedded
          ? 'flex scroll-mt-4 flex-col gap-1.5 py-3.5'
          : 'flex scroll-mt-4 flex-col gap-2.5 rounded-[22px] border border-linha bg-cartao p-4'
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold text-tinta">{t.profile.pushTitle}</span>
        {(status === 'disabled' || status === 'enabled') && (
          <button
            type="button"
            role="switch"
            aria-checked={status === 'enabled'}
            disabled={busy}
            onClick={status === 'enabled' ? disablePush : enablePush}
            aria-label={t.profile.pushTitle}
            className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              status === 'enabled' ? 'bg-menta' : 'bg-papel-2 ring-1 ring-linha'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-cartao shadow ring-1 ring-black/5 transition-all ${
                status === 'enabled' ? 'left-[24px]' : 'left-1'
              }`}
            />
          </button>
        )}
      </div>
      <p className="text-[13px] leading-[19px] text-tinta-suave">{t.profile.pushStatus[status]}</p>
    </section>
  );
}
