'use server';
import { revalidatePath } from 'next/cache';
import { pixKeyBody, type PixKeyResponse } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type PixKeyState = { pixKey?: string | null; error?: string; ok?: string };

/** O perfil e a tela de cada acerto (que monta o "copia e cola") mostram a chave. */
function revalidatePix() {
  revalidatePath('/perfil');
  revalidatePath('/acertos', 'layout');
}

const falha = (e: unknown): PixKeyState => ({
  error: e instanceof ApiError ? e.message : 'Não consegui salvar agora. Tenta de novo.',
});

export async function salvarChavePix(input: { type: string; key: string }): Promise<PixKeyState> {
  const parsed = pixKeyBody.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const saved = await api<PixKeyResponse>('/me/pix-key', { method: 'PUT', body: parsed.data });
    revalidatePix();
    return { pixKey: saved.pixKey, ok: 'Chave salva. Já dá pra cobrar nos acertos.' };
  } catch (e) {
    rethrowIfRedirect(e);
    return falha(e);
  }
}

export async function apagarChavePix(): Promise<PixKeyState> {
  try {
    await api('/me/pix-key', { method: 'DELETE' });
    revalidatePix();
    return { pixKey: null, ok: 'Chave apagada.' };
  } catch (e) {
    rethrowIfRedirect(e);
    return falha(e);
  }
}
