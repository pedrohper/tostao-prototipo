import { Mascote } from '@/components/mascote';
import { BackLink, Card } from '@/components/ui';
import { ImportForm } from './import-form';

export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  const { conta } = await searchParams;
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
      <ImportForm conta={conta} />
      <Card className="flex flex-col gap-2 text-[14px] leading-relaxed">
        <h2 className="font-display text-lg font-extrabold">Onde baixar</h2>
        <p><b>Nubank:</b> no app, abre a conta ou a fatura e toca em “Exportar extrato” / “Enviar por e-mail”: vem um CSV.</p>
        <p><b>Itaú, Bradesco, Santander, BB, Inter:</b> no internet banking, extrato → salvar/exportar em <b>OFX</b> (às vezes chamado de “Money” ou “Quicken”).</p>
        <p>Pode importar o mesmo período de novo sem medo: o que já estava aqui eu pulo.</p>
      </Card>
    </div>
  );
}
