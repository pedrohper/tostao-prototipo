// Resumo do mês compartilhável (T6.19): os números que vão pra imagem. Puro.
// Regra de privacidade: nada de nome nem e-mail da pessoa (este módulo nem recebe isso), e valores em reais só quando
// ela pede (o padrão é só porcentagem).
import type { LessonProgressResponse, MonthSummaryResponse } from '@tostao/contracts';
import { money, monthName } from './format';

export type MonthShare = {
  month: string;
  monthName: string;
  year: string;
  /** Mês ainda em andamento. */
  partial: boolean;
  /** % da renda que sobrou (negativo = saiu mais do que entrou). null = mês sem renda registrada. */
  savedPercent: number | null;
  topCategory: { name: string; percent: number; totalInCents: number } | null;
  /** null = não deu pra buscar: a imagem sai sem esse bloco, em vez de mostrar um número errado. */
  streakDays: number | null;
  incomeInCents: number;
  outcomeInCents: number;
};

/**
 * Texto que a fonte da imagem sabe desenhar (latim básico e acentuado). Emoji ou outro alfabeto faria o gerador de
 * imagem buscar fonte e figura num servidor de fora, levando o texto junto.
 */
export function drawableText(raw: string, max = 22): string {
  const clean = raw
    .normalize('NFC')
    .replace(/[^\x20-\x7e¡-¬®-ÿ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Outros';
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

export function monthShare(
  summary: Pick<MonthSummaryResponse, 'incomeInCents' | 'outcomeInCents' | 'byCategory'>,
  progress: Pick<LessonProgressResponse, 'streakDays'> | null,
  month: string,
  thisMonth: string,
): MonthShare {
  const { incomeInCents, outcomeInCents } = summary;
  const top = summary.byCategory
    .filter((c) => c.categoryId && c.totalInCents > 0)
    .sort((a, b) => b.totalInCents - a.totalInCents)[0];
  return {
    month,
    monthName: monthName(month),
    year: month.slice(0, 4),
    partial: month >= thisMonth,
    savedPercent: incomeInCents > 0 ? Math.round(((incomeInCents - outcomeInCents) * 100) / incomeInCents) : null,
    topCategory:
      top && outcomeInCents > 0
        ? {
            name: drawableText(top.name),
            percent: Math.round((top.totalInCents * 100) / outcomeInCents),
            totalInCents: top.totalInCents,
          }
        : null,
    streakDays: progress ? progress.streakDays : null,
    incomeInCents,
    outcomeInCents,
  };
}

export type ShareTexts = {
  title: string;
  subtitle: string;
  headline: { label: string; value: string; note: string; good: boolean };
  /** Linhas com valores em reais; vazio quando eles estão escondidos. */
  amounts: string[];
  category: { label: string; name: string; note: string };
  streak: { label: string; value: string } | null;
};

/** Os textos da imagem, no tom do Tostão. Com `showValues` falso, nenhum deles tem valor em reais. */
export function shareTexts(data: MonthShare, showValues: boolean): ShareTexts {
  const saved = data.savedPercent;
  const leftover = data.incomeInCents - data.outcomeInCents;
  const headline =
    saved === null
      ? { label: 'MÊS ANOTADO', value: 'Feito', note: 'sem renda registrada neste mês', good: false }
      : saved >= 0
        ? { label: 'GUARDEI', value: `${saved}%`, note: 'do que entrou', good: true }
        : {
            label: 'GASTEI',
            // Renda quase zero daria um número gigante que não cabe (nem ajuda).
            value: 100 - saved > 999 ? '+999%' : `${100 - saved}%`,
            note: 'do que entrou (mês apertado)',
            good: false,
          };
  const category = data.topCategory
    ? {
        label: 'ONDE MAIS FOI',
        name: data.topCategory.name,
        note: `${data.topCategory.percent}% dos meus gastos${showValues ? ` · ${money(data.topCategory.totalInCents)}` : ''}`,
      }
    : { label: 'ONDE MAIS FOI', name: 'A descobrir', note: 'gastos ainda sem categoria' };
  return {
    title: `Meu ${data.monthName}`,
    subtitle: data.partial ? `${data.year} · até aqui` : data.year,
    headline,
    amounts: showValues
      ? [
          `Entrou ${money(data.incomeInCents)}`,
          `Saiu ${money(data.outcomeInCents)}`,
          `${leftover >= 0 ? 'Sobrou' : 'Faltou'} ${money(Math.abs(leftover))}`,
        ]
      : [],
    category,
    streak:
      data.streakDays === null
        ? null
        : data.streakDays > 0
          ? { label: 'OFENSIVA', value: `${data.streakDays} ${data.streakDays === 1 ? 'dia' : 'dias'}` }
          : { label: 'OFENSIVA', value: 'Bora começar' },
  };
}

/** Limite simples em memória (a web roda num processo só): `max` imagens por pessoa a cada janela. */
export function createWindowLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    if (hits.size > 1000) {
      for (const [k, times] of hits) if (times.every((x) => t - x >= windowMs)) hits.delete(k);
    }
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    const allowed = recent.length < max;
    if (allowed) recent.push(t);
    hits.set(key, recent);
    return allowed;
  };
}
