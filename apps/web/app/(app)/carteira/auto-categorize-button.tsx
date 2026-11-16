'use client';
import { Icon } from '@/components/icone';
import { useActionState } from 'react';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { autoCategorize, type AutoState } from './actions';

/** Botão na aba "sem categoria": a IA tenta categorizar o que as regras não pegaram. */
export function AutoCategorizeButton({ t }: { t?: Dictionary['walletExtra']['autoCategorize'] }) {
  const labels = t ?? getDictionary('pt-BR').walletExtra.autoCategorize;
  const [state, action, pending] = useActionState<AutoState>(autoCategorize, {});
  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-2xl bg-amarelo-claro p-3.5">
      <p className="text-[14px] leading-snug text-tinta">
        <strong>{labels.introBold}</strong>
        {labels.introBody}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-tinta px-4 py-2 text-[13px] font-semibold text-papel disabled:opacity-60"
      >
        {pending ? (
          labels.pending
        ) : (
          <span className="flex items-center gap-1.5">
            <Icon src="ui/categorizar-ia" size={18} />
            {labels.cta}
          </span>
        )}
      </button>
      {state.message && (
        <p role="status" className="text-[13px] text-tinta-suave">
          {state.message}
        </p>
      )}
    </form>
  );
}
