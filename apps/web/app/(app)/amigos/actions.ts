'use server';
import { revalidatePath } from 'next/cache';
import { addFriendBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';

export type AmigoState = { error?: string; message?: string };

export async function addFriend(_: AmigoState, form: FormData): Promise<AmigoState> {
  const parsed = addFriendBody.safeParse({ code: form.get('code') });
  if (!parsed.success) return { error: 'Cola o código inteiro, tipo TOST-AB3CD.' };
  try {
    await api('/friends', { method: 'POST', body: parsed.data });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Não deu agora. Tenta de novo?' };
  }
  revalidatePath('/amigos');
  return { message: 'Pronto, agora vocês tão no mesmo desafio.' };
}

export async function removeFriend(id: string) {
  await api(`/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  revalidatePath('/amigos');
}
