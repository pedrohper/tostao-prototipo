import type { Repositories } from '../repositories/types.js';
import type { Battle, Transaction } from '../domain/entities.js';
import { AppError } from '../domain/errors.js';
import { caseOfWeek, TRIBUNAL_CASES } from '../lib/tribunal-cases.js';

const DAY = 24 * 60 * 60 * 1000;
export const TIGRINHO_DAYS = 30;
export const XP_PER_VOTE = 20;
export const XP_PER_BATTLE = 100;

export const URUBU_STEPS = [
  { id: 'limite-noturno', label: 'Baixar o limite do Pix à noite (das 20h às 6h) pra R$ 200 ou menos' },
  { id: 'chaves', label: 'Conferir as chaves Pix cadastradas e apagar as que não usa' },
  { id: 'palavra-senha', label: 'Combinar uma palavra-senha com a família pra pedido de dinheiro por mensagem' },
] as const;

/** Aposta = categoria "apostas" (regras: BET365, BLAZE, PIXBET...). Só saída conta. */
const isBet = (t: Transaction) => t.categoryId === 'apostas' && t.amountInCents < 0 && !t.isInternalTransfer;

/**
 * Batalha contra o Tigrinho: 30 dias sem aposta, conferido no extrato.
 * Função pura: recebe a batalha e as transações desde o início e devolve o estado atual.
 */
export function tigrinhoState(b: Battle, txs: Transaction[], now: Date) {
  const bets = txs.filter((t) => isBet(t) && t.occurredAt >= b.startedAt).sort((a, c) => a.occurredAt.getTime() - c.occurredAt.getTime());
  const day = Math.min(TIGRINHO_DAYS, Math.floor((now.getTime() - b.startedAt.getTime()) / DAY) + 1);
  if (b.status === 'perdida' || b.status === 'vencida') return { status: b.status, day, lostAt: bets[0]?.occurredAt ?? b.endedAt };
  if (bets.length) return { status: 'perdida' as const, day, lostAt: bets[0]!.occurredAt };
  if (now.getTime() - b.startedAt.getTime() >= TIGRINHO_DAYS * DAY) return { status: 'vencida' as const, day: TIGRINHO_DAYS, lostAt: null };
  return { status: 'ativa' as const, day, lostAt: null };
}

export class GamesUseCase {
  constructor(private readonly repos: Pick<Repositories, 'games' | 'transactions' | 'connections'>, private readonly now: () => Date = () => new Date()) {}

  async tribunal(userId: string) {
    const { case: c, endsAt } = caseOfWeek(this.now());
    const [mine, counts] = await Promise.all([this.repos.games.findVote(userId, c.id), this.repos.games.countVotes(c.id)]);
    const votes = c.options.map((_, i) => counts[i] ?? 0);
    const voted = mine !== null;
    return {
      case: { id: c.id, title: c.title, story: c.story, question: c.question, options: c.options },
      endsAt: endsAt.toISOString(),
      totalVotes: votes.reduce((a, b) => a + b, 0),
      myVote: mine?.choice ?? null,
      // Só mostra o placar e o veredito depois de votar (senão vira efeito manada)
      votes: voted ? votes : null,
      verdict: voted ? { title: c.verdictTitle, text: c.verdict } : null,
    };
  }

  async vote(userId: string, caseId: string, choice: number) {
    const { case: current } = caseOfWeek(this.now());
    const c = TRIBUNAL_CASES.find((x) => x.id === caseId);
    if (!c || c.id !== current.id) throw new AppError('Esse caso já encerrou. Tem um novo essa semana.', 400);
    if (!Number.isInteger(choice) || choice < 0 || choice >= c.options.length) throw new AppError('Opção inválida.', 400);
    await this.repos.games.vote(userId, caseId, choice);
    return this.tribunal(userId);
  }

  async battles(userId: string) {
    const now = this.now();
    const { games, transactions, connections } = this.repos;
    const [tig, uru, conns] = await Promise.all([games.findBattle(userId, 'tigrinho'), games.findBattle(userId, 'urubu'), connections.listByUser(userId)]);
    let tigrinho = null;
    if (tig) {
      const txs = await transactions.findManyInRange(userId, tig.startedAt, now);
      const st = tigrinhoState(tig, txs, now);
      if (st.status !== tig.status) await games.saveBattle({ ...tig, status: st.status, endedAt: st.status === 'perdida' ? (st.lostAt ?? now) : now });
      tigrinho = { status: st.status, startedAt: tig.startedAt.toISOString(), day: st.day, totalDays: TIGRINHO_DAYS, lostAt: st.lostAt ? new Date(st.lostAt).toISOString() : null };
    }
    const urubuUnlocked = tigrinho?.status === 'vencida';
    const done = new Set(uru?.steps ?? []);
    return {
      // Sem banco nem extrato, não tem como conferir: aí vale a palavra da pessoa.
      checksStatement: conns.length > 0,
      tigrinho,
      urubu: {
        status: !urubuUnlocked ? ('bloqueada' as const) : uru?.status === 'vencida' ? ('vencida' as const) : ('ativa' as const),
        steps: URUBU_STEPS.map((s) => ({ id: s.id, label: s.label, done: done.has(s.id) })),
      },
    };
  }

  async startTigrinho(userId: string) {
    const current = await this.repos.games.findBattle(userId, 'tigrinho');
    if (current?.status === 'ativa') return this.battles(userId);
    await this.repos.games.saveBattle({ userId, kind: 'tigrinho', status: 'ativa', startedAt: this.now(), endedAt: null, steps: [] });
    return this.battles(userId);
  }

  async toggleUrubuStep(userId: string, stepId: string, done: boolean) {
    const state = await this.battles(userId);
    if (state.urubu.status === 'bloqueada') throw new AppError('Primeiro vence o Tigrinho.', 400);
    if (!URUBU_STEPS.some((s) => s.id === stepId)) throw new AppError('Passo inválido.', 400);
    const b = (await this.repos.games.findBattle(userId, 'urubu')) ?? { userId, kind: 'urubu' as const, status: 'ativa' as const, startedAt: this.now(), endedAt: null, steps: [] };
    const steps = new Set(b.steps);
    if (done) steps.add(stepId); else steps.delete(stepId);
    const all = URUBU_STEPS.every((s) => steps.has(s.id));
    await this.repos.games.saveBattle({ ...b, steps: [...steps], status: all ? 'vencida' : 'ativa', endedAt: all ? this.now() : null });
    return this.battles(userId);
  }

  /** XP extra dos jogos: cada voto e cada batalha vencida. */
  async bonusXp(userId: string) {
    const [votes, battles] = await Promise.all([this.repos.games.countUserVotes(userId), this.repos.games.listBattles(userId)]);
    return votes * XP_PER_VOTE + battles.filter((b) => b.status === 'vencida').length * XP_PER_BATTLE;
  }
}
