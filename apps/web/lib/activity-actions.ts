'use server';
import type { ActivityKind } from '@tostao/contracts';
import { api } from './api';

/** Marca a missão de "abrir tal tela" como feita. Falhar aqui não pode quebrar a tela. */
export async function registrarVisita(kind: Extract<ActivityKind, `visita:${string}`>) {
  await api('/activity', { method: 'POST', body: { kind } }).catch(() => {});
}
