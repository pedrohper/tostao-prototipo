'use client';
import { useActionState } from 'react';
import type { AutomationTokenDTO } from '@tostao/contracts';
import { Button, ErrorNote } from '@/components/ui';
import { CopyField } from './copy-field';
import { createAutomationToken, revokeAutomationToken, type TokenState } from './actions';

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
      })
    : null;

/** Gerar e revogar tokens (máx. 3 ativos). O token novo aparece UMA vez, aqui. */
export function TokensManager({ tokens, limit }: { tokens: AutomationTokenDTO[]; limit: number }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(createAutomationToken, {});
  const active = tokens.filter((t) => !t.revokedAt);
  const full = active.length >= limit;
  return (
    <div className="flex flex-col gap-4">
      {state.token && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-tinta bg-amarelo-claro p-3.5"
        >
          <p className="text-[14px] leading-5">
            <b>Token “{state.label}” criado.</b> Copie agora e guarde no Atalho: <b>ele não aparece de novo</b> (o
            Tostão só guarda uma impressão digital dele). Se perder, revogue e gere outro.
          </p>
          <CopyField label="Seu token" value={state.token} />
        </div>
      )}
      {tokens.length > 0 && (
        <ul className="flex flex-col divide-y divide-linha rounded-2xl border border-linha bg-cartao px-3.5">
          {tokens.map((t) => (
            <li key={t.id} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 flex-col">
                <span
                  className={`truncate text-[15px] font-semibold ${t.revokedAt ? 'text-tinta-suave line-through' : ''}`}
                >
                  {t.label}
                </span>
                <span className="text-[12px] text-tinta-suave">
                  {t.revokedAt
                    ? `Revogado em ${when(t.revokedAt)}`
                    : t.lastUsedAt
                      ? `Último uso em ${when(t.lastUsedAt)}`
                      : `Criado em ${when(t.createdAt)} · ainda não usado`}
                </span>
              </div>
              {!t.revokedAt && (
                <form action={revokeAutomationToken}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="h-10 px-2 text-[14px] font-semibold text-vermelho-texto hover:underline"
                  >
                    Revogar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">Nome do atalho</span>
          <input
            name="label"
            required
            maxLength={60}
            placeholder="Ex.: Apple Pay do iPhone"
            disabled={full}
            className="h-11 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta disabled:opacity-50"
          />
        </label>
        <ErrorNote message={state.error} />
        <Button type="submit" disabled={pending || full}>
          {pending ? 'Gerando…' : full ? `Limite de ${limit} tokens ativos` : 'Gerar token'}
        </Button>
        {full && <p className="text-[12px] text-tinta-suave">Revogue um token pra gerar outro.</p>}
      </form>
    </div>
  );
}
