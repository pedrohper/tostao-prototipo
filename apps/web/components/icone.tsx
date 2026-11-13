/** Ícones desenhados (public/icones). Todos têm fundo transparente; o tamanho é o lado em px. */
export function Icone({ src, size = 24, alt = '', className = '' }: { src: string; size?: number; alt?: string; className?: string }) {
  return <img src={`/icones/${src}.png`} width={size} height={size} alt={alt} aria-hidden={alt ? undefined : true} className={`shrink-0 ${className}`} draggable={false} />;
}

const CATEGORIAS_COM_ICONE = new Set([
  'apostas', 'assinaturas', 'casa', 'comer-fora', 'compras', 'delivery', 'entrada-outros', 'estudo', 'jogos',
  'mercado', 'nao-conta', 'outros', 'role', 'salario', 'saude', 'sem-categoria', 'transporte',
]);

/** Ícone da categoria: desenho próprio pras do sistema, emoji pras que a pessoa criou. */
export function CatIcon({ id, emoji, size = 24 }: { id: string | null | undefined; emoji?: string | null; size?: number }) {
  if (id && CATEGORIAS_COM_ICONE.has(id)) return <Icone src={`cat/${id}`} size={size} />;
  return <span aria-hidden="true" style={{ fontSize: size * 0.75, lineHeight: 1 }}>{emoji ?? '🏷️'}</span>;
}
