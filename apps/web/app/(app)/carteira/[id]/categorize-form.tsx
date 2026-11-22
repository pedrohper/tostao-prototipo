'use client';
import { Icon } from '@/components/icone';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { CategoryPicker } from '@/components/category-picker';
import { ErrorNote } from '@/components/ui';
import { getDictionary, type Locale } from '@/lib/i18n';
import { categorize, type ActionState } from '../actions';

type Props = {
  id: string;
  back: string;
  /** Categorias que servem pra este lançamento (do tipo dele + "Não conta"). */
  options: CategoryDTO[];
  /** Tipo do lançamento: define a lista e o tipo que "+ Criar categoria" já vem marcado. */
  kind: 'saida' | 'entrada';
  current: string | null;
  rulePattern: string;
  locale?: Locale;
};

export function CategorizeForm({ id, back, options, kind, current, rulePattern, locale = 'pt-BR' }: Props) {
  const dict = getDictionary(locale);
  const labels = dict.walletExtra.txDetail;
  const saveLabel = dict.common.save;
  const savingLabel = dict.common.saving;
  const [state, action, pending] = useActionState<ActionState, FormData>(categorize, {});
  const [picked, setPicked] = useState(current);
  // Nome da escolhida: vem da lista, ou da própria categoria quando acabou de ser criada aqui (ainda não está em `options`).
  const [pickedCat, setPickedCat] = useState<CategoryDTO | null>(options.find((o) => o.id === current) ?? null);
  const pickedName = pickedCat?.id === picked ? pickedCat.name : options.find((o) => o.id === picked)?.name;
  return (
    <form action={action} className="flex grow flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      {current && <input type="hidden" name="previousCategoryId" value={current} />}
      <fieldset className="flex min-w-0 flex-col gap-2.5">
        <legend className="mb-2.5 text-[13px] font-semibold text-tinta-suave">{labels.categorizeLabel}</legend>
        <CategoryPicker
          categories={options}
          kind={kind}
          includeNeutral
          value={picked}
          onChange={(next, category) => {
            setPicked(next);
            setPickedCat(category ?? null);
          }}
          name="categoryId"
          label={labels.categorizeLabel}
          locale={locale}
        />
      </fieldset>
      {picked === 'nao-conta' && (
        <p className="flex gap-2 text-sm text-tinta-suave">
          <Icon src="cat/nao-conta" size={20} />
          <span>{labels.neutralHint}</span>
        </p>
      )}
      {rulePattern.length >= 3 && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-papel-2 px-3.5 py-2 text-sm leading-5">
          <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 shrink-0 accent-tinta" />
          <span>{labels.alwaysRule(rulePattern, pickedName ?? '…')}</span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <div className="grow" />
      {/*
        Rodapé fixo: o corpo da folha rola e o Salvar fica colado embaixo (sticky dentro da área rolável), com respiro
        pra barra de gestos/navegação do Android (safe-area). Os -mx anulam o padding horizontal da folha.
      */}
      <div className="sticky bottom-0 z-10 -mx-5 border-t border-linha bg-papel px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
        <button
          type="submit"
          disabled={!picked || pending}
          className="flex h-[54px] w-full shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50"
        >
          {pending ? savingLabel : saveLabel}
        </button>
      </div>
    </form>
  );
}
