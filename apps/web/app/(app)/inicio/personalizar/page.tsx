import { BackLink } from '@/components/ui';
import { SECOES, lerPrefs, ordemDe } from '@/lib/inicio-prefs';
import { PersonalizarForm } from './form';

export default async function PersonalizarInicioPage() {
  const prefs = await lerPrefs();
  const linhas = ordemDe(prefs).map((id) => SECOES.find((s) => s.id === id)!).map((s) => ({ id: s.id, nome: s.nome, dica: s.dica }));
  return (
    <div className="flex flex-col gap-3.5">
      <BackLink href="/inicio" label="Início" />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Seu Início, do seu jeito</h1>
      <p className="text-[15px] leading-[21px] text-tinta-suave">Escolha o que aparece e em que ordem. O saldo fica sempre no topo.</p>
      <PersonalizarForm linhas={linhas} ocultos={prefs.ocultos} padrao={SECOES.map((s) => s.id)} />
    </div>
  );
}
