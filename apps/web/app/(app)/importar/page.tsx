import type { ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { ImportForm } from './import-form';

const BANCOS: { nome: string; passo: string }[] = [
  { nome: 'Nubank', passo: 'Conta: no app, toca no saldo → ícone de compartilhar → “Exportar extrato” (vem um CSV por e-mail). Cartão: fatura → “Enviar fatura por e-mail” e usa o CSV.' },
  { nome: 'Inter', passo: 'App → Extrato → ícone de download → escolhe o período → formato CSV ou OFX.' },
  { nome: 'Itaú', passo: 'Pelo site (no app não tem): Extrato → período → “Salvar em OFX” (às vezes aparece como Money).' },
  { nome: 'Bradesco', passo: 'Pelo site: Saldos e extratos → Extrato → “Exportar” → OFX ou CSV.' },
  { nome: 'Banco do Brasil', passo: 'Pelo site: Extrato → escolhe o mês → “Salvar” → OFX ou CSV.' },
  { nome: 'Caixa', passo: 'Pelo site: Extrato → período → exportar em OFX.' },
  { nome: 'Santander', passo: 'Pelo site: Conta corrente → Extrato → “Exportar” → OFX.' },
  { nome: 'C6 Bank', passo: 'App → Extrato → ícone de compartilhar → “Exportar extrato” → CSV.' },
  { nome: 'Mercado Pago', passo: 'Pelo site: Seu dinheiro → Relatórios → “Extrato da conta” → gera e baixa o CSV.' },
  { nome: 'PicPay', passo: 'App → Extrato → ícone de download → período → CSV (chega por e-mail).' },
];

export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
  const me = await api<ProfileResponse>('/me').catch(() => null);
  const contas = (me?.connections ?? []).filter((c) => c.itemId.startsWith('import:')).map((c) => c.institution ?? '').filter(Boolean);
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/conectar" />
      <div className="flex items-center gap-3">
        <Mascote pose="investigando" size={72} alt="" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Importar extrato</h1>
          <p className="text-[15px] text-tinta-suave">Sem Open Finance, sem senha. Só o arquivo.</p>
        </div>
      </div>
      <ImportForm conta={conta} contas={contas} />
      <div className="flex flex-col rounded-2xl bg-papel-2 px-3.5 py-3 text-[13px] leading-[19px]">
        <h2 className="text-[14px] font-bold">Onde baixar</h2>
        {BANCOS.map((b) => (
          <details key={b.nome} className="border-b border-linha last-of-type:border-0">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">{b.nome}<span aria-hidden className="text-tinta-suave">+</span></summary>
            <p className="pb-1 text-tinta-suave">{b.passo}</p>
          </details>
        ))}
        <p className="pt-2 text-tinta-suave">Pode importar o mesmo período de novo sem medo: o que já estava aqui eu pulo. Os menus dos bancos mudam de vez em quando: se não achar, procura “Exportar” ou “Extrato” no app ou no site. Banco que não tá na lista? Manda o CSV mesmo, eu tento entender.</p>
      </div>
    </div>
  );
}
