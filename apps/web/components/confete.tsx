// Chuva de confete de uma vez (meta batida, lição fechada). Só CSS; some com "reduzir movimento".
const CORES = ['#FF5A36', '#FFC233', '#3DD6A0', '#DCEBFF', '#FFE1E7'];

export function Confete({ n = 28 }: { n?: number }) {
  return (
    <div className="confete" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        // Determinístico (sem Math.random) pra servidor e cliente desenharem igual.
        const left = (i * 37) % 100;
        const dx = (((i * 53) % 120) - 60);
        const rot = ((i * 97) % 720) - 360;
        return <i key={i} style={{ left: `${left}%`, background: CORES[i % CORES.length], animationDelay: `${(i % 7) * 0.06}s`, ['--dx' as string]: `${dx}px`, ['--rot' as string]: `${rot}deg` }} />;
      })}
    </div>
  );
}
