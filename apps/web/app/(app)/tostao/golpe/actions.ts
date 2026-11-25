'use server';
import { scamCheckBody, type ScamCheckResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type ScamActionResult =
  { ok: true; data: ScamCheckResponse } | { ok: false; error: string; needsConsent?: boolean };

/** A mensagem vai no corpo (nunca na URL) e não fica guardada em lugar nenhum. */
export async function analisarMensagem(message: string): Promise<ScamActionResult> {
  const parsed = scamCheckBody.safeParse({ message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Mensagem inválida.' };
  try {
    return { ok: true, data: await api<ScamCheckResponse>('/chat/scam-check', { method: 'POST', body: parsed.data }) };
  } catch (e) {
    rethrowIfRedirect(e);
    if (e instanceof ApiError && e.code === 'AI_CONSENT_REQUIRED')
      return { ok: false, error: e.message, needsConsent: true };
    return { ok: false, error: e instanceof ApiError ? e.message : 'Não consegui analisar agora.' };
  }
}
