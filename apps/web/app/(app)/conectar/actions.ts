'use server';
import { revalidateFinance } from '@/lib/revalidate';
import {
  connectBankBody,
  type ConnectTokenResponse,
  type DisconnectResponse,
  type SyncResponse,
} from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { safePathSegment } from '@/lib/safe-redirect';
import { rethrowIfRedirect } from '@/lib/rethrow';
import { isConnectedButNotSynced } from '@/lib/conectar-widget';

export type ConnectState = { error?: string; ok?: string };

export async function connectBank(_: ConnectState, form: FormData): Promise<ConnectState> {
  return connectItem(String(form.get('itemId') ?? ''));
}

/** Liga um Item ao usuário. Usado pelo campo manual e pelo onSuccess do Pluggy Connect. */
export async function connectItem(itemId: string): Promise<ConnectState> {
  const parsed = connectBankBody.safeParse({ itemId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    const r = await api<SyncResponse>('/connections', { method: 'POST', body: parsed.data });
    revalidateFinance();
    return {
      ok: `Conectado! ${r.accounts} ${r.accounts === 1 ? 'conta' : 'contas'} e ${r.importedCount} transações novas.`,
    };
  } catch (e) {
    rethrowIfRedirect(e);
    const message = e instanceof ApiError ? e.message : 'Algo deu errado.';
    // Conectou e só o sync falhou: a conexão precisa aparecer na lista pra pessoa tocar em "Sincronizar agora".
    if (isConnectedButNotSynced(message)) revalidateFinance();
    return { error: message };
  }
}

/** Token novo a cada clique: ele vale uns 30 min, então não dá pra guardar da renderização. */
export async function getConnectToken(): Promise<{ connectToken?: string | null; error?: string }> {
  try {
    return await api<ConnectTokenResponse>('/connections/connect-token', { method: 'POST', body: {} });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export async function syncNow(_: ConnectState, form: FormData): Promise<ConnectState> {
  try {
    const r = await api<SyncResponse>(`/connections/${safePathSegment(form.get('id'))}/sync`, {
      method: 'POST',
      body: {},
    });
    revalidateFinance();
    return { ok: r.importedCount ? `${r.importedCount} transações novas.` : 'Já tava tudo em dia.' };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}

export async function disconnectBank(_: ConnectState, form: FormData): Promise<ConnectState> {
  try {
    const r = await api<DisconnectResponse>(`/connections/${safePathSegment(form.get('id'))}`, { method: 'DELETE' });
    revalidateFinance();
    return {
      ok: r.providerDeleted
        ? 'Banco removido.'
        : 'Removido do Tostão. O Pluggy não respondeu: se quiser, revoga em meu.pluggy.ai.',
    };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'Algo deu errado.' };
  }
}
