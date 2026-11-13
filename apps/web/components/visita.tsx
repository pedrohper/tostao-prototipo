'use client';
import { useEffect } from 'react';
import { registrarVisita } from '@/lib/activity-actions';

/** Abriu a tela = missão do dia feita (quando a missão de hoje é essa). */
export function Visita({ kind }: { kind: Parameters<typeof registrarVisita>[0] }) {
  useEffect(() => { void registrarVisita(kind); }, [kind]);
  return null;
}
