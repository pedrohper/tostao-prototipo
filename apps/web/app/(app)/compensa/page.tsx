import { pct, TAXAS_REFERENCIA, type TaxasResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { CompensaParcelar } from '@/components/juros';

export default async function CompensaPage() {
  const taxas = await api<TaxasResponse>('/rates').catch(() => TAXAS_REFERENCIA);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/aprender" />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Compensa parcelar?</h1>
      <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
        <Mascote pose="investigando" size={72} alt="" />
        <p className="text-[15px] leading-[21px]">Coloca o preço à vista e o parcelado. Eu acho os juros escondidos e comparo com deixar o dinheiro rendendo ({pct(taxas.cdi)} ao ano no CDI).</p>
      </div>
      <CompensaParcelar taxas={taxas} />
    </div>
  );
}
