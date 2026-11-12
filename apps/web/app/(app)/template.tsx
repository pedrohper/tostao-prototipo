// Remonta a cada navegação, então a animação de entrada roda em toda tela (ver .tela no globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="tela">{children}</div>;
}
