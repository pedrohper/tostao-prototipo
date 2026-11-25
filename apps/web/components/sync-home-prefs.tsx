'use client';
import { useEffect, useRef } from 'react';
import { syncHomePrefs } from '@/lib/inicio-actions';

/**
 * Invisível. A Home só o monta quando este aparelho tem preferências pra subir pra conta ou a cópia local está velha
 * (T6.11): cookie só pode ser gravado por uma Server Action, nunca durante o desenho da página.
 */
export function SyncHomePrefs() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void syncHomePrefs().catch(() => {}); // sem rede: fica pra próxima visita
  }, []);
  return null;
}
