// Decide, SEM validar assinatura (quem valida é a API), se vale tentar renovar a sessão.
// Nunca confie nisto pra autorizar nada: serve só pra não bater na API à toa.

/** Renova quando faltam 2 min ou menos pro access token vencer. */
export const REFRESH_SKEW_SECONDS = 120;

export function accessTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Só tenta renovar quando existe refresh token (sem ele, não há o que renovar: cookie forjado de access token
 * sozinho não gera chamada nenhuma). Access ausente (o cookie expirou), ilegível ou perto de vencer → renova.
 */
export function shouldRefresh({
  access,
  refresh,
  nowSeconds,
}: {
  access: string | undefined;
  refresh: string | undefined;
  nowSeconds: number;
}): boolean {
  if (!refresh) return false;
  if (!access) return true;
  const exp = accessTokenExp(access);
  if (exp === null) return true;
  return exp - nowSeconds <= REFRESH_SKEW_SECONDS;
}

/** O `sub` (id da pessoa) do access token, SEM validar a assinatura. Só pra amarrar dado temporário à pessoa; nunca pra autorizar. */
export function accessTokenSub(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return typeof payload.sub === 'string' && payload.sub.length > 0 && payload.sub.length <= 64 ? payload.sub : null;
  } catch {
    return null;
  }
}
