// BFF da imagem do resumo do mês (T6.19): `GET /api/fechamento/imagem?mes=AAAA-MM[&valores=1]`.
// Só entrega a imagem de quem está logado (o token vem do cookie httpOnly; não existe parâmetro de pessoa) e só busca
// o resumo do mês e a ofensiva: nome e e-mail nem passam por aqui. Dependências injetadas, como no export.
import { MONTH_PATTERN, type LessonProgressResponse, type MonthSummaryResponse } from '@tostao/contracts';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';
import { isSameOriginRequest } from './export-proxy';
import { currentMonth, shiftMonth } from './format';
import { monthShare, type MonthShare } from './resumo-mes';
import { accessTokenSub } from './token-expiry';

export type ShareImageDeps = {
  getToken: () => Promise<string | null>;
  apiUrl: string;
  appPublicUrl?: string;
  render: (data: MonthShare, showValues: boolean) => Promise<ArrayBuffer>;
  /** false = essa pessoa passou do limite de imagens. */
  allow: (userKey: string) => boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const OFFLINE = 'Não consegui falar com o servidor agora. Tenta de novo em instantes.';

export async function shareImage(request: Request, deps: ShareImageDeps): Promise<Response> {
  if (!isSameOriginRequest(request.headers, deps.appPublicUrl)) return json(403, 'Origem não permitida.');
  const token = await deps.getToken();
  if (!token) return json(401, 'Sessão vencida.');

  const query = new URL(request.url).searchParams;
  const thisMonth = currentMonth(deps.now?.());
  const month = query.get('mes') ?? shiftMonth(thisMonth, -1);
  if (!MONTH_PATTERN.test(month)) return json(400, 'Use AAAA-MM no mês.');
  // Escondido por padrão: só "valores=1" mostra reais.
  const showValues = query.get('valores') === '1';

  const fetchImpl = deps.fetchImpl ?? fetch;
  const get = (path: string) =>
    fetchImpl(`${deps.apiUrl}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      cache: 'no-store',
      signal: request.signal,
    });

  let summary: MonthSummaryResponse;
  let progress: LessonProgressResponse | null = null;
  try {
    const [summaryRes, progressRes] = await Promise.all([
      get(`/summary?month=${month}`),
      get('/progress').catch(() => null),
    ]);
    if (!summaryRes.ok) {
      const body = (await summaryRes.json().catch(() => null)) as { message?: string } | null;
      return json(summaryRes.status, body?.message ?? 'Não deu pra montar a imagem agora.');
    }
    summary = (await summaryRes.json()) as MonthSummaryResponse;
    if (progressRes?.ok) progress = (await progressRes.json()) as LessonProgressResponse;
  } catch {
    return json(502, OFFLINE);
  }

  if (summary.incomeInCents === 0 && summary.outcomeInCents === 0)
    return json(404, 'Esse mês ainda não tem movimento pra resumir.');

  // Só depois de a API aceitar o token é que o id dentro dele vale como chave do limite.
  if (!deps.allow(accessTokenSub(token) ?? 'sem-id'))
    return json(429, 'Muitas imagens em pouco tempo. Tenta de novo daqui a 5 minutos.');

  let png: ArrayBuffer;
  try {
    png = await deps.render(monthShare(summary, progress, month, thisMonth), showValues);
  } catch (error) {
    console.error('[resumo-mes] falha ao desenhar a imagem:', (error as Error).message);
    return json(500, 'Não deu pra desenhar a imagem agora.');
  }
  return new Response(png, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'content-disposition': `inline; filename="tostao-${month}.png"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}
