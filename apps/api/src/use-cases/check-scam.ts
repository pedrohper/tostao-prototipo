import type { ScamCheckResponse } from '@tostao/contracts';
import { AiUnavailableError, type AiGateway } from '../gateways/ai-gateway.js';
import { testOnlyKeyValueStore, type KeyValueStore } from '../lib/redis.js';
import { withTimeout } from '../lib/wait-for.js';
import type { Repositories } from '../repositories/types.js';
import { scrubPastedMessage } from '../services/pii-scrubber.js';
import { parseScamReply, scamChecklist, scamMessages, scamResult } from '../services/scam-check.js';
import { requireAiConsent } from './ai-consent.js';

const DAY_SECONDS = 24 * 60 * 60;
/** Teto da espera pela IA: passou disso, vai a lista fixa (quem está na dúvida de um golpe não pode ficar esperando). */
export const SCAM_AI_TIMEOUT_MS = 20_000;

/**
 * "Isso é golpe?" Exige o aceite do aviso de IA (como o chat), gasta a MESMA cota diária do chat e não guarda nem a
 * mensagem nem a resposta: texto de desconhecido não entra no histórico que depois vai de contexto pro chat.
 */
export class CheckScamUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users'>,
    private readonly ai: AiGateway,
    private readonly dailyLimit = 40,
    private readonly kv: KeyValueStore = testOnlyKeyValueStore(),
    private readonly timeoutMs = SCAM_AI_TIMEOUT_MS,
  ) {}

  async execute({ userId, message }: { userId: string; message: string }): Promise<ScamCheckResponse> {
    // LGPD: nada sai pro provedor de IA sem o aceite explícito.
    const user = await requireAiConsent(this.repos.users, userId);
    if (!this.ai.enabled) return scamChecklist('sem_ia');

    const quotaKey = `ai:chat:quota:${userId}`;
    if ((await this.kv.incr(quotaKey, DAY_SECONDS)) > this.dailyLimit) {
      await this.kv.decr(quotaKey);
      return scamChecklist('limite');
    }

    let raw: string;
    try {
      raw = await withTimeout(
        this.ai.reply(scamMessages(scrubPastedMessage(message, user.name)), {
          json: true,
          temperature: 0.2,
          maxTokens: 600,
        }),
        this.timeoutMs,
        'análise de golpe',
      );
    } catch (error) {
      // A chamada saiu (a cota conta, como no chat), mas a pessoa não fica sem resposta.
      if (!(error instanceof AiUnavailableError)) console.warn('[golpe] IA falhou:', (error as Error).message);
      return scamChecklist('falha');
    }
    const analysis = parseScamReply(raw);
    // As regras olham o texto original (aqui dentro do servidor); pro provedor só foi o mascarado.
    return analysis ? scamResult(analysis, message) : scamChecklist('falha');
  }
}
