// Cliente do chat em streaming (T4.5), sem React: o ChatClient só liga estes pedaços ao estado da tela.
// Regra de ouro do fallback: se o stream nem chegou a começar (nenhum evento recebido), usamos o caminho normal
// (`ask()`); se já começou, NÃO repetimos a pergunta (a cota e uma eventual proposta já existem no servidor): mostramos erro.
import type { ChatStreamEvent } from '@tostao/contracts';

export const CHAT_STREAM_URL = '/api/chat/stream';

type DoneEvent = Extract<ChatStreamEvent, { type: 'done' }>;

function isEvent(v: unknown): v is ChatStreamEvent {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  switch (e.type) {
    case 'status':
    case 'delta':
      return typeof e.text === 'string';
    case 'done':
      return Boolean(e.question && e.reply) && typeof e.reply === 'object';
    case 'error':
      return typeof e.message === 'string' && typeof e.status === 'number';
    default:
      return false;
  }
}

/** SSE incremental: recebe pedaços de texto da rede (cortados em qualquer lugar) e devolve os eventos completos. */
export function createSseParser(): (chunk: string) => ChatStreamEvent[] {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const out: ChatStreamEvent[] = [];
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data) continue; // comentário/keep-alive
      try {
        const parsed: unknown = JSON.parse(data);
        if (isEvent(parsed)) out.push(parsed);
      } catch {
        // evento quebrado: ignora esse e segue com os próximos
      }
    }
    return out;
  };
}

/** O que a tela mostra enquanto a resposta chega. */
export type StreamView = { status: string | null; text: string };
export const EMPTY_STREAM_VIEW: StreamView = { status: null, text: '' };

export function reduceStreamView(view: StreamView, event: ChatStreamEvent): StreamView {
  if (event.type === 'status') return { ...view, status: event.text };
  if (event.type === 'delta') return { status: null, text: view.text + event.text };
  return view;
}

export type StreamOutcome =
  | { kind: 'done'; event: DoneEvent }
  /** O stream não está disponível (rede, proxy, 5xx): usar o caminho normal. */
  | { kind: 'fallback' }
  | { kind: 'consent'; message: string }
  | { kind: 'unauthorized' }
  | { kind: 'error'; message: string }
  /** Começou e caiu no meio: o texto parcial não foi gravado, a pessoa precisa perguntar de novo. */
  | { kind: 'interrupted' }
  | { kind: 'aborted' };

export async function runChatStream({
  message,
  signal,
  onEvent,
  fetchImpl = fetch,
}: {
  message: string;
  signal?: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
  fetchImpl?: typeof fetch;
}): Promise<StreamOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(CHAT_STREAM_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch {
    return signal?.aborted ? { kind: 'aborted' } : { kind: 'fallback' };
  }

  if (res.status === 401) return { kind: 'unauthorized' };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
    if (res.status === 403 && body?.code === 'AI_CONSENT_REQUIRED')
      return { kind: 'consent', message: body.message ?? '' };
    // Erro "da pessoa" (cota, pergunta inválida): mostra a mensagem da API. O resto (404, 5xx, HTML do proxy): fallback.
    if ((res.status === 400 || res.status === 429) && body?.message) return { kind: 'error', message: body.message };
    return { kind: 'fallback' };
  }
  if (!res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) return { kind: 'fallback' };

  const parse = createSseParser();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sawEvent = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parse(decoder.decode(value, { stream: true }))) {
        sawEvent = true;
        onEvent(event);
        if (event.type === 'done') return { kind: 'done', event };
        if (event.type === 'error') return { kind: 'error', message: event.message };
      }
    }
  } catch {
    if (signal?.aborted) return { kind: 'aborted' };
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (signal?.aborted) return { kind: 'aborted' };
  return sawEvent ? { kind: 'interrupted' } : { kind: 'fallback' };
}
