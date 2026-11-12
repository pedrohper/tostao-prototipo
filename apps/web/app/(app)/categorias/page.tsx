import { CatIcon, Icone } from '@/components/icone';
import type { CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink, Card } from '@/components/ui';
import { CategoryForm, DeleteCategoryButton } from './category-form';

export default async function CategoriasPage() {
  const { categories } = await api<{ categories: CategoryDTO[] }>('/categories');
  const mine = categories.filter((c) => c.custom);
  const system = categories.filter((c) => !c.custom);
  const group = (list: CategoryDTO[], kind: CategoryDTO['kind']) => list.filter((c) => c.kind === kind);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/perfil" />
      <div className="flex items-center gap-3">
        <Mascote pose="professor" size={72} alt="Tostão professor" />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Minhas categorias</h1>
          <p className="text-[15px] text-tinta-suave">Cria as suas, do jeito que você pensa no dinheiro.</p>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-extrabold">Nova categoria</h2>
        <CategoryForm />
      </Card>

      {mine.length > 0 && (
        <Card className="flex flex-col divide-y divide-linha p-0">
          {mine.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4">
              <span className="flex items-center gap-1.5 font-semibold"><CatIcon id={c.id} emoji={c.emoji} size={20} /> {c.name} <span className="text-[13px] font-normal text-tinta-suave">· {c.kind === 'saida' ? 'gasto' : 'entrada'}</span></span>
              <DeleteCategoryButton id={c.id} name={c.name} />
            </div>
          ))}
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-[20px] bg-amarelo-claro p-3">
        <Icone src="cat/nao-conta" size={36} />
        <p className="text-sm"><b>Não conta</b> serve pra dinheiro que só passa por você: repasse com a família, acerto com amigo, grana que é de outra pessoa. Coloca a transação lá e marca &quot;sempre&quot;: some do gasto e da renda.</p>
      </div>

      <div className="flex flex-col gap-2 text-sm text-tinta-suave">
        <span className="font-semibold">Já vêm no app</span>
        <p className="flex flex-wrap gap-x-3 gap-y-1">Gasto: {group(system, 'saida').map((c) => <span key={c.id} className="flex items-center gap-1"><CatIcon id={c.id} emoji={c.emoji} size={18} />{c.name}</span>)}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">Entrada: {group(system, 'entrada').map((c) => <span key={c.id} className="flex items-center gap-1"><CatIcon id={c.id} emoji={c.emoji} size={18} />{c.name}</span>)}</p>
      </div>
    </div>
  );
}
