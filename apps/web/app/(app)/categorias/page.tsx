import { CatIcon, Icon } from '@/components/icone';
import type { CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Card, PageFrame } from '@/components/ui';
import { CategoryForm, DeleteCategoryButton } from './category-form';

export default async function CategoriasPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, { categories }, { t }] = await Promise.all([
    searchParams,
    api<{ categories: CategoryDTO[] }>('/categories'),
    getI18n(),
  ]);
  const p = t.pages.categorias;
  const mine = categories.filter((c) => c.custom);
  const system = categories.filter((c) => !c.custom);
  const group = (list: CategoryDTO[], kind: CategoryDTO['kind']) => list.filter((c) => c.kind === kind);
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center gap-3">
        <Mascot pose="professor" size={72} alt={p.mascotAlt} />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{p.title}</h1>
          <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold">{p.newTitle}</h2>
        <CategoryForm t={p.form} />
      </Card>

      {mine.length > 0 && (
        <Card className="flex flex-col divide-y divide-linha p-0">
          {mine.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <span className="flex items-center gap-1.5 font-semibold">
                <CatIcon id={c.id} emoji={c.emoji} size={20} /> {c.name}{' '}
                <span className="text-[13px] font-normal text-tinta-suave">
                  · {c.kind === 'saida' ? p.spendingTag : p.incomeTag}
                </span>
              </span>
              <DeleteCategoryButton id={c.id} name={c.name} t={p.form} deleteLabel={t.common.delete} />
            </div>
          ))}
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-[20px] bg-amarelo-claro p-3">
        <Icon src="cat/nao-conta" size={36} />
        <p className="text-sm">
          <b>{p.notCountedBold}</b>
          {p.notCountedBody}
        </p>
      </div>

      <div className="flex flex-col gap-2 text-sm text-tinta-suave">
        <span className="font-semibold">{p.builtInTitle}</span>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          {p.spendingRow}{' '}
          {group(system, 'saida').map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <CatIcon id={c.id} emoji={c.emoji} size={18} />
              {c.name}
            </span>
          ))}
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          {p.incomeRow}{' '}
          {group(system, 'entrada').map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <CatIcon id={c.id} emoji={c.emoji} size={18} />
              {c.name}
            </span>
          ))}
        </p>
      </div>
    </PageFrame>
  );
}
