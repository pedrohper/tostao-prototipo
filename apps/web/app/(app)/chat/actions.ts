'use server';
import { revalidatePath } from 'next/cache';
import {
  chatBody,
  pendingActionBody,
  type ChatReplyResponse,
  type ConfirmPendingActionResponse,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type AskResult = { ok: true; data: ChatReplyResponse } | { ok: false; error: string; needsConsent?: boolean };

export async function ask(message: string): Promise<AskResult> {
  const parsed = chatBody.safeParse({ message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pergunta inválida.' };
  try {
    return { ok: true, data: await api<ChatReplyResponse>('/chat', { method: 'POST', body: parsed.data }) };
  } catch (e) {
    rethrowIfRedirect(e);
    if (e instanceof ApiError && e.code === 'AI_CONSENT_REQUIRED')
      return { ok: false, error: e.message, needsConsent: true };
    return { ok: false, error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export type PendingResult = { ok: true; message: string } | { ok: false; error: string };

/** A IA só propõe. Gravar o lançamento é este clique: confirma (ou cancela) a proposta de uso único. */
export async function resolvePendingAction(actionId: string, confirm: boolean): Promise<PendingResult> {
  const parsed = pendingActionBody.safeParse({ actionId });
  if (!parsed.success) return { ok: false, error: 'Proposta inválida.' };
  try {
    const r = await api<ConfirmPendingActionResponse>(confirm ? '/chat/confirm' : '/chat/cancel', {
      method: 'POST',
      body: parsed.data,
    });
    if (confirm) revalidatePath('/', 'layout'); // o lançamento novo aparece na Carteira e no Início
    return { ok: true, message: r.message };
  } catch (e) {
    rethrowIfRedirect(e);
    return { ok: false, error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
