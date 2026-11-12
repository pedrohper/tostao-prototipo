'use server';
import { chatBody, type ChatReplyResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type AskResult = { ok: true; data: ChatReplyResponse } | { ok: false; error: string };

export async function ask(message: string): Promise<AskResult> {
  const parsed = chatBody.safeParse({ message });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Pergunta inválida.' };
  try {
    return { ok: true, data: await api<ChatReplyResponse>('/chat', { method: 'POST', body: parsed.data }) };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
