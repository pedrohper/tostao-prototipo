'use server';
import { revalidatePath } from 'next/cache';
import { tribunalVoteBody, type TribunalResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export async function voteTribunal(caseId: string, choice: number): Promise<{ result?: TribunalResponse; error?: string }> {
  const body = tribunalVoteBody.safeParse({ caseId, choice });
  if (!body.success) return { error: 'Opção inválida.' };
  try {
    const result = await api<TribunalResponse>('/tribunal/votes', { method: 'POST', body: body.data });
    revalidatePath('/aprender');
    return { result };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
