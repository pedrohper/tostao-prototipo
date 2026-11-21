'use server';
import { revalidatePath } from 'next/cache';
import { addFriendBody } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { orFallback, rethrowIfRedirect } from '@/lib/rethrow';

export type AmigoState = { error?: string; message?: string };

export async function addFriend(_: AmigoState, form: FormData): Promise<AmigoState> {
  const parsed = addFriendBody.safeParse({ code: form.get('code') });
  if (!parsed.success) return { error: 'Cola o código inteiro, tipo TOST-AB3CD.' };
  try {
    await api('/friends', { method: 'POST', body: parsed.data });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Não deu agora. Tenta de novo?' };
  }
  revalidatePath('/amigos');
  // Usar o código manda um PEDIDO: a outra pessoa precisa aceitar pra entrar no desafio.
  return { message: 'Pedido enviado! Quando a pessoa aceitar, vocês entram no mesmo desafio.' };
}

export async function removeFriend(id: string) {
  await api(`/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(orFallback(undefined));
  revalidatePath('/amigos');
}

/** Aceitar ou recusar um pedido de amizade recebido (o id é o do PEDIDO). */
export async function respondFriendRequest(id: string, accept: boolean) {
  try {
    await api(`/friends/requests/${encodeURIComponent(id)}/${accept ? 'accept' : 'decline'}`, {
      method: 'POST',
      body: {},
    });
  } catch (e) {
    rethrowIfRedirect(e);
    // Pedido que já não existe (cancelado, já respondido): a tela só recarrega.
  }
  revalidatePath('/amigos');
}
