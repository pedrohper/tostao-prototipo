// Seed do usuário de demonstração (dados fictícios), usado pelo `pnpm shots`. NÃO faz parte do `db:seed`.
//
//   NODE_ENV=development DEMO_DATABASE_URL=postgresql://…@127.0.0.1:5432/tostao_shots \
//   DEMO_PASSWORD=… tsx src/demo/seed-demo.ts --confirmo-banco-de-demo
//
// Recusa produção, banco remoto, banco sem "demo/test/shots" no nome e banco com conta de gente de verdade (guard.ts).
// Pode rodar várias vezes: apaga só as contas de demonstração e cria de novo. Precisa das categorias do `db:seed`.
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/password.js';
import { DEFAULT_TIMEZONE, addCivilDays, civilDay, noonOfCivilDay } from '../lib/tz.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { RunTostaoChecksUseCase } from '../use-cases/tostao-auto.js';
import { weekStart } from '../use-cases/engagement.js';
import {
  DEMO_BUDGETS,
  DEMO_CHAT,
  DEMO_EMAIL,
  DEMO_EMAILS,
  DEMO_FRIENDS,
  DEMO_INVITE_CODE,
  DEMO_LESSONS,
  DEMO_NAME,
  DEMO_PEOPLE,
  buildDemoAccounts,
  buildDemoActivities,
  buildDemoPlan,
  buildDemoTransactions,
  demoCalendar,
  type DemoPersonKey,
} from './data.js';
import { DEMO_FLAG, DemoGuardError, assertDemoTarget, assertOnlyTestAccounts } from './guard.js';

async function seed(prisma: PrismaClient, password: string, now: Date) {
  const tz = DEFAULT_TIMEZONE;
  const cal = demoCalendar(now, tz);
  const daysAgo = (n: number) => noonOfCivilDay(addCivilDays(cal.today, -n), tz);
  const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);
  const passwordHash = await hashPassword(password);

  await prisma.$transaction(
    async (tx) => {
      // Só as contas de demonstração (e o que é delas, em cascata). O convite não cai em cascata: apaga à parte.
      await tx.invite.deleteMany({ where: { code: DEMO_INVITE_CODE } });
      await tx.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS] } } });

      const user = await tx.user.create({
        data: {
          name: DEMO_NAME,
          email: DEMO_EMAIL,
          passwordHash,
          emailVerifiedAt: daysAgo(90),
          termsAcceptedAt: daysAgo(90),
          termsVersion: 'demo',
          aiConsentAt: daysAgo(60),
          createdAt: daysAgo(190),
        },
      });
      const userId = user.id;

      await tx.userConsent.createMany({
        data: (['terms', 'privacy', 'ai'] as const).map((type) => ({
          userId,
          type,
          version: 'demo',
          grantedAt: daysAgo(type === 'ai' ? 60 : 90),
        })),
      });

      // lastSyncedAt recente: a API não sai sincronizando o banco de exemplo por cima destes dados quando sobe.
      const connectionIds = new Map<string, string>();
      for (const c of [
        { key: 'nubank', itemId: 'demo-item-nubank', institution: 'Nubank', synced: minutesAgo(35) },
        { key: 'inter', itemId: 'demo-item-inter', institution: 'Inter', synced: minutesAgo(50) },
        { key: 'manual', itemId: 'manual:contas', institution: 'Contas manuais', synced: null },
      ]) {
        const created = await tx.bankConnection.create({
          data: {
            userId,
            itemId: c.itemId,
            institution: c.institution,
            lastSyncedAt: c.synced,
            createdAt: daysAgo(180),
          },
        });
        connectionIds.set(c.key, created.id);
      }

      const accountIds = new Map<string, string>();
      for (const { key, connection, ...data } of buildDemoAccounts(now, tz)) {
        const created = await tx.account.create({
          data: {
            ...data,
            userId,
            connectionId: connectionIds.get(connection)!,
            externalId: connection === 'manual' ? `manual:demo-${key}` : `demo:${key}`,
          },
        });
        accountIds.set(key, created.id);
      }

      const personIds = new Map<DemoPersonKey, string>();
      for (const [key, name] of Object.entries(DEMO_PEOPLE) as [DemoPersonKey, string][]) {
        personIds.set(key, (await tx.person.create({ data: { userId, name } })).id);
      }

      await tx.transaction.createMany({
        data: buildDemoTransactions(now, tz).map((t, i) => ({
          userId,
          accountId: t.account ? accountIds.get(t.account)! : null,
          externalId: t.manual ? null : `demo:tx:${i}`,
          description: t.description,
          amountInCents: BigInt(t.amountInCents),
          occurredAt: t.occurredAt,
          categoryId: t.categoryId,
          isInternalTransfer: t.isInternalTransfer ?? false,
          personId: t.person ? personIds.get(t.person)! : null,
          note: t.note ?? null,
          settledAt: t.pending ? null : t.occurredAt,
          balanceAppliedAt: t.manual && t.account && !t.pending ? t.occurredAt : null,
          createdAt: t.occurredAt < now ? t.occurredAt : now,
        })),
      });

      await tx.financialPlan.create({ data: { userId, data: buildDemoPlan(now, tz) } });
      await tx.categoryBudget.createMany({ data: DEMO_BUDGETS.map((b) => ({ ...b, userId })) });
      await tx.lessonProgress.createMany({
        data: DEMO_LESSONS.map((l) => ({ userId, lessonId: l.lessonId, completedAt: daysAgo(l.daysAgo) })),
      });
      await tx.userActivity.createMany({
        data: buildDemoActivities(now, tz).map((a) => ({ userId, kind: a.kind, day: new Date(`${a.day}T00:00:00Z`) })),
      });
      await tx.chatMessage.createMany({
        data: DEMO_CHAT.map((m, i) => ({ userId, ...m, createdAt: minutesAgo((DEMO_CHAT.length - i) * 3 + 20) })),
      });
      await tx.reconciledNote.create({
        data: {
          userId,
          description: 'Ifood de sexta',
          amountInCents: BigInt(-5890),
          occurredAt: daysAgo(3),
          categoryId: 'delivery',
          bankDescription: 'IFD*PIZZARIA BELLA',
          reconciledAt: daysAgo(2),
        },
      });
      const nextMonth = (day: number) => cal.at(1, day);
      await tx.recurringRule.createMany({
        data: [
          { kind: 'entrada' as const, description: 'Salário', amountInCents: BigInt(248000), day: 5, cat: 'salario' },
          { kind: 'saida' as const, description: 'Aluguel', amountInCents: BigInt(65000), day: 8, cat: 'casa' },
        ].map((r) => ({
          userId,
          accountId: accountIds.get('nubank')!,
          categoryId: r.cat,
          kind: r.kind,
          description: r.description,
          amountInCents: r.amountInCents,
          frequency: 'MONTHLY' as const,
          dayOfMonth: r.day,
          autoPost: false, // só alimenta a previsão: o job não cria lançamento por cima da demonstração
          nextRunAt: nextMonth(r.day),
        })),
      });

      // Jogos e amigos
      await tx.battle.createMany({
        data: [
          { userId, kind: 'tigrinho', status: 'ativa', startedAt: daysAgo(12) },
          { userId, kind: 'urubu', status: 'ativa', startedAt: daysAgo(5), steps: ['chaves'] },
        ],
      });
      await tx.tribunalVote.create({
        data: { userId, caseId: 'emprestar-pro-amigo', weekKey: weekStart(addCivilDays(cal.today, -7)), choice: 1 },
      });
      await tx.invite.create({ data: { code: DEMO_INVITE_CODE, createdById: userId } });
      await tx.friendCode.create({ data: { userId, code: 'TOST-DEMO1' } });

      for (const f of DEMO_FRIENDS) {
        const friend = await tx.user.create({
          data: { name: f.name, email: f.email, createdAt: daysAgo(120) }, // sem senha: ninguém entra nela
        });
        await tx.friendCode.create({ data: { userId: friend.id, code: f.code } });
        await tx.userActivity.createMany({
          data: Array.from({ length: f.streak }, (_, i) => ({
            userId: friend.id,
            day: new Date(`${addCivilDays(cal.today, -i)}T00:00:00Z`),
            kind: i % 2 ? 'categorizar' : 'anotar',
          })),
        });
        if (f.key === 'bia') {
          await tx.friendRequest.create({ data: { requesterId: friend.id, addresseeId: userId } });
        } else {
          await tx.friendship.createMany({
            data: [
              { userId, friendId: friend.id },
              { userId: friend.id, friendId: userId },
            ],
          });
        }
      }
    },
    { timeout: 30_000 },
  );

  // Os achados do Tostão saem das mesmas rotinas que rodam em produção (nada de texto inventado aqui).
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } });
  const checks = await new RunTostaoChecksUseCase(makePrismaRepositories(prisma), () => now).execute({
    userId: user.id,
  });
  return {
    transactions: await prisma.transaction.count({ where: { userId: user.id } }),
    insights: checks.insights.length,
  };
}

/** Banco ou tabela que ainda não existe: é um banco novo, sem ninguém. */
function isNewDatabase(err: unknown) {
  const { code, errorCode, message } = err as { code?: string; errorCode?: string; message?: string };
  if (code === 'P2021' || code === 'P1003' || errorCode === 'P1003') return true;
  return /Database `[^`]+` does not exist/.test(message ?? '');
}

async function main() {
  const databaseUrl = process.env.DEMO_DATABASE_URL;
  const target = assertDemoTarget({ nodeEnv: process.env.NODE_ENV, argv: process.argv.slice(2), databaseUrl });
  const given = process.env.DEMO_PASSWORD;
  if (given !== undefined && given.length < 12) {
    throw new DemoGuardError('DEMO_PASSWORD precisa de pelo menos 12 caracteres (ou deixe vazia pra sortear uma).');
  }
  const password = given || randomBytes(18).toString('base64url');
  // A URL vai direto pro cliente: o DATABASE_URL de um .env nunca é usado aqui.
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl! });
  // `--apenas-conferir`: o `pnpm shots` roda isto ANTES das migrations, pra não escrever nada num banco errado.
  const onlyCheck = process.argv.includes('--apenas-conferir');
  try {
    const existing = await prisma.user.findMany({ select: { email: true } }).catch((err: unknown) => {
      if (onlyCheck && isNewDatabase(err)) return []; // só a conferência aceita: as migrations ainda não rodaram
      throw err;
    });
    assertOnlyTestAccounts(existing.map((u) => u.email));
    if (onlyCheck) {
      console.log(`✅ ${target.database} em ${target.host}:${target.port} é um banco de demonstração.`);
      return;
    }
    if ((await prisma.category.count()) === 0) {
      throw new DemoGuardError('O banco está sem categorias: rode o seed normal (prisma/seed.ts) antes.');
    }
    const result = await seed(prisma, password, new Date());
    console.log(
      `🧪 Demonstração criada em ${target.database} (${civilDay(new Date(), DEFAULT_TIMEZONE)}): ${DEMO_EMAIL}, ` +
        `${result.transactions} lançamentos e ${result.insights} achados do Tostão.`,
    );
    // Só mostra a senha sorteada (pra quem rodou à mão conseguir entrar). A que veio por variável não é repetida.
    if (!given) console.log(`🔑 Senha sorteada pra ${DEMO_EMAIL}: ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (err) {
  if (err instanceof DemoGuardError) {
    console.error(`❌ ${err.message}`);
    console.error(`   Uso: NODE_ENV=development DEMO_DATABASE_URL=… tsx src/demo/seed-demo.ts ${DEMO_FLAG}`);
  } else {
    console.error('❌ Seed de demonstração falhou:', err);
  }
  process.exit(1);
}
