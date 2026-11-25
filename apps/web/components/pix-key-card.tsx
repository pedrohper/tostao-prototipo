'use client';
// Perfil → "Chave Pix" (T6.16). Sem `name` nos campos de propósito: um envio antes do JavaScript carregar não leva a
// chave pra URL (onde ela iria parar em histórico e log).
import { useState, useTransition } from 'react';
import { PIX_KEY_TYPES, PIX_KEY_TYPE_LABELS, type PixKeyResponse, type PixKeyType } from '@tostao/contracts';
import { apagarChavePix, salvarChavePix, type PixKeyState } from '@/app/(app)/perfil/pix-actions';

const FIELD: Record<PixKeyType, { inputMode: 'numeric' | 'email' | 'tel' | 'text'; placeholder: string }> = {
  cpf: { inputMode: 'numeric', placeholder: '000.000.000-00' },
  cnpj: { inputMode: 'numeric', placeholder: '00.000.000/0000-00' },
  email: { inputMode: 'email', placeholder: 'voce@exemplo.com' },
  telefone: { inputMode: 'tel', placeholder: '(11) 91234-5678' },
  aleatoria: { inputMode: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
};

const control =
  'h-[52px] w-full min-w-0 rounded-2xl border-[1.5px] border-linha bg-papel px-4 text-base text-tinta outline-none focus:border-tinta';

export function PixKeyCard({ initial }: { initial: PixKeyResponse }) {
  const [type, setType] = useState<PixKeyType>(initial.type ?? 'cpf');
  const [value, setValue] = useState(initial.pixKey ?? '');
  const [saved, setSaved] = useState(initial.pixKey !== null);
  const [state, setState] = useState<PixKeyState>({});
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<PixKeyState>) =>
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (result.pixKey === undefined) return; // erro: o que a pessoa digitou continua no campo
      setValue(result.pixKey ?? '');
      setSaved(result.pixKey !== null);
    });

  return (
    <section
      id="pix"
      aria-labelledby="pix-titulo"
      className="flex scroll-mt-6 flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-[18px]"
    >
      <div className="flex flex-col gap-1">
        <h2 id="pix-titulo" className="text-base font-bold text-tinta">
          Chave Pix
        </h2>
        <p className="text-[13px] leading-[18px] text-tinta-suave">
          Opcional. Com ela, o botão “Cobrar no Pix” dos acertos monta o copia e cola pra você.
        </p>
      </div>

      <form
        method="post"
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => salvarChavePix({ type, key: value }));
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Tipo de chave</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as PixKeyType);
              setValue('');
              setState({});
            }}
            className={control}
          >
            {PIX_KEY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PIX_KEY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Sua chave</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode={FIELD[type].inputMode}
            placeholder={FIELD[type].placeholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={120}
            aria-invalid={state.error ? true : undefined}
            className={control}
          />
        </label>

        <p role="status" aria-live="polite" className="text-[13px] font-semibold empty:hidden">
          {state.error ? (
            <span className="text-vermelho-texto">{state.error}</span>
          ) : state.ok ? (
            <span className="text-verde-texto">{state.ok}</span>
          ) : null}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="h-[50px] rounded-full bg-tinta text-[15px] font-semibold text-papel disabled:opacity-60"
        >
          {pending ? 'Salvando…' : 'Salvar chave'}
        </button>
        {saved && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(apagarChavePix)}
            className="min-h-11 text-[13px] font-semibold text-vermelho-texto disabled:opacity-60"
          >
            Apagar chave
          </button>
        )}
      </form>

      <p className="text-xs leading-[18px] text-tinta-suave">
        Quem receber o código vê a chave e o seu nome. Se não quiser mostrar CPF ou celular, cria uma chave aleatória no
        app do banco. Ela entra no “Baixar meus dados” e some se você apagar a conta.
      </p>
    </section>
  );
}
