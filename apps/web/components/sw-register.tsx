'use client';
import { useEffect } from 'react';

/** Registra o service worker (página "sem internet" + avisos). Falhar não atrapalha o app: só some o offline. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
