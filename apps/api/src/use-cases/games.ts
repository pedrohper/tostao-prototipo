import type { Repositories } from '../repositories/types.js';
import type { Battle, Transaction } from '../domain/entities.js';
import { AppError, ConflictError } from '../domain/errors.js';
import { civilDay, diffCivilDays, startOfCivilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import { isBetTransaction } from '../services/bets.js';
import { weekStart } from './engagement.js';
import { caseOfWeek, TRIBUNAL_CASES } from '../lib/tribunal-cases.js';

export const TIGRINHO_DAYS = 30;
export const XP_PER_VOTE = 20;
export const XP_PER_BATTLE = 100;

export const URUBU_STEPS = [
  { id: 'limite-noturno', label: 'Baixar o limite do Pix à noite (das 20h às 6h) pra R$ 200 ou menos' },
  { id: 'chaves', label: 'Conferir as chaves Pix cadastradas e apagar as que não usa' },
  { id: 'palavra-senha', label: 'Combinar uma palavra-senha com a família pra pedido de dinheiro por mensagem' },
] as const;

/**
 * Batalha contra o Tigrinho: 30 dias sem aposta, conferido no extrato.
 * Função pura: recebe a batalha e as transações desde o início e devolve o estado atual.
 */
export function tigrinhoState(b: Battle, txs: Transaction[], now: Date, tz?: string) {
  // O Dia 1 vale o dia civil INTEIRO: uma aposta feita de manhã, antes da pessoa abrir a batalha à tarde, já conta.
  const startDay = civilDay(b.startedAt, tz);
  const from = startOfCivilDay(startDay, tz);
  const bets = txs
    .filter((t) => isBetTransaction(t) && t.occurredAt >= from)
    .sort((a, c) => a.occurredAt.getTime() - c.occurredAt.getTime());
  const dayAt = (at: Date) => Math.min(TIGRINHO_DAYS, diffCivilDays(startDay, civilDay(at, tz)) + 1);
  const finished = b.status === 'perdida' || b.status === 'vencida';
  const lostAt = bets[0]?.occurredAt ?? b.endedAt;
  // Perdida: o contador PARA no dia da aposta (não segue subindo enquanto a pessoa abre o app).
  if (finished || bets.length) {
    const status = finished ? b.status : ('perdida' as const);
    if (status === 'vencida') return { status, day: TIGRINHO_DAYS, lostAt: null };
    return { status, day: dayAt(lostAt ?? now), lostAt: lostAt ?? null };
  }
  if (diffCivilDays(startDay, civilDay(now, tz)) >= TIGRINHO_DAYS)
    return { status: 'vencida' as const, day: TIGRINHO_DAYS, lostAt: null };
  return { status: 'ativa' as const, day: dayAt(now), lostAt: null };
}

export class GamesUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'games' | 'transactions' | 'connections' | 'users'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async tribunal(userId: string) {
    const { case: c, endsAt } = caseOfWeek(this.now());
    const weekKey = await this.weekKey(userId);
    const [mine, counts] = await Promise.all([
      this.repos.games.findVote(userId, c.id, weekKey),
      this.repos.games.countVotes(c.id, weekKey),
    ]);
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

  /** Segunda-feira (dia civil, fuso da pessoa) da semana de hoje: a chave do voto. */
  private async weekKey(userId: string) {
    return weekStart(civilDay(this.now(), await timezoneOf(this.repos.users, userId)));
  }

  async vote(userId: string, caseId: string, choice: number) {
    const { case: current } = caseOfWeek(this.now());
    const c = TRIBUNAL_CASES.find((x) => x.id === caseId);
    if (!c || c.id !== current.id) throw new AppError('Esse caso já encerrou. Tem um novo essa semana.', 400);
    if (!Number.isInteger(choice) || choice < 0 || choice >= c.options.length)
      throw new AppError('Opção inválida.', 400);
    // Voto dado não se troca (senão dá pra ver o placar e votar de novo no lado que ganha).
    const created = await this.repos.games.vote(userId, caseId, await this.weekKey(userId), choice);
    if (!created) throw new ConflictError('Você já votou nesse caso essa semana.');
    return this.tribunal(userId);
  }

  async battles(userId: string) {
    const now = this.now();
    const { games, transactions, connections } = this.repos;
    const [tig, uru, conns] = await Promise.all([
      games.findBattle(userId, 'tigrinho'),
      games.findBattle(userId, 'urubu'),
      connections.listByUser(userId),
    ]);
    let tigrinho = null;
    if (tig) {
      const tz = await timezoneOf(this.repos.users, userId);
      const txs = await transactions.findManyInRange(userId, startOfCivilDay(civilDay(tig.startedAt, tz), tz), now);
      const st = tigrinhoState(tig, txs, now, tz);
      if (st.status !== tig.status)
        await games.saveBattle({
          ...tig,
          status: st.status,
          endedAt: st.status === 'perdida' ? (st.lostAt ?? now) : now,
        });
      tigrinho = {
        status: st.status,
        startedAt: tig.startedAt.toISOString(),
        day: st.day,
        totalDays: TIGRINHO_DAYS,
        lostAt: st.lostAt ? new Date(st.lostAt).toISOString() : null,
      };
    }
    const urubuUnlocked = tigrinho?.status === 'vencida';
    const done = new Set(uru?.steps ?? []);
    return {
      // Sem banco nem extrato, não tem como conferir: aí vale a palavra da pessoa.
      checksStatement: conns.length > 0,
      tigrinho,
      urubu: {
        status: !urubuUnlocked
          ? ('bloqueada' as const)
          : uru?.status === 'vencida'
            ? ('vencida' as const)
            : ('ativa' as const),
        steps: URUBU_STEPS.map((s) => ({ id: s.id, label: s.label, done: done.has(s.id) })),
      },
    };
  }

  async startTigrinho(userId: string) {
    // battles() primeiro: ele atualiza o status (uma batalha que já passou de 30 dias é "vencida", não "ativa").
    await this.battles(userId);
    const current = await this.repos.games.findBattle(userId, 'tigrinho');
    // Só recomeça quem perdeu. Batalha ativa segue e batalha VENCIDA nunca é sobrescrita (a conquista é da pessoa).
    if (current && current.status !== 'perdida') return this.battles(userId);
    await this.repos.games.saveBattle({
      userId,
      kind: 'tigrinho',
      status: 'ativa',
      startedAt: this.now(),
      endedAt: null,
      steps: [],
    });
    return this.battles(userId);
  }

  async toggleUrubuStep(userId: string, stepId: string, done: boolean) {
    const state = await this.battles(userId);
    if (state.urubu.status === 'bloqueada') throw new AppError('Primeiro vence o Tigrinho.', 400);
    if (!URUBU_STEPS.some((s) => s.id === stepId)) throw new AppError('Passo inválido.', 400);
    // Lock otimista: dois toques seguidos em passos diferentes não apagam um ao outro.
    await this.repos.games.mutateBattle(userId, 'urubu', (current) => {
      const b = current ?? {
        userId,
        kind: 'urubu' as const,
        status: 'ativa' as const,
        startedAt: this.now(),
        endedAt: null,
        steps: [],
      };
      const steps = new Set(b.steps);
      if (done) steps.add(stepId);
      else steps.delete(stepId);
      const all = URUBU_STEPS.every((s) => steps.has(s.id));
      return { ...b, steps: [...steps], status: all ? 'vencida' : 'ativa', endedAt: all ? this.now() : null };
    });
    return this.battles(userId);
  }

  /** XP extra dos jogos: cada voto e cada batalha vencida. */
  async bonusXp(userId: string) {
    const [votes, battles] = await Promise.all([
      this.repos.games.countUserVotes(userId),
      this.repos.games.listBattles(userId),
    ]);
    return votes * XP_PER_VOTE + battles.filter((b) => b.status === 'vencida').length * XP_PER_BATTLE;
  }
}
