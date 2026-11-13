'use server';
import { pushSubscriptionBody } from '@tostao/contracts';
import { api } from './api';

export async function salvarInscricao(sub: unknown) {
  const parsed = pushSubscriptionBody.safeParse(sub);
  if (!parsed.success) return { ok: false };
  await api('/push/subscriptions', { method: 'POST', body: parsed.data });
  return { ok: true };
}

export async function apagarInscricao(endpoint: string) {
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint } }).catch(() => {});
}
