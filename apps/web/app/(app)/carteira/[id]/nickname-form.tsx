'use client';
import { useActionState, useEffect } from 'react';
import { ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';
import { getDictionary, type Locale } from '@/lib/i18n';
import { saveNickname, type ActionState } from '../actions';

/** Apelido amigável pra transação com nome críptico do banco. A descrição original não muda (fica no rodapé). */
export function NicknameForm({
  id,
  current,
  locale = 'pt-BR',
}: {
  id: string;
  current: string | null;
  locale?: Locale;
}) {
  const d = getDictionary(locale).growth.detail;
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveNickname, {});

  useEffect(() => {
    if (state.saved) toast.success(d.nicknameSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a uma nova resposta da ação
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-tinta-suave">{d.nicknameLabel}</span>
        <input
          name="customDescription"
          defaultValue={current ?? ''}
          maxLength={80}
          placeholder={d.nicknamePlaceholder}
          className="h-11 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta"
        />
      </label>
      <p className="text-xs text-tinta-suave">{d.nicknameHint}</p>
      <ErrorNote message={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-cartao text-sm font-semibold text-tinta transition-colors hover:bg-papel-2 disabled:opacity-60"
      >
        {d.nicknameSave}
      </button>
    </form>
  );
}
