import type { ReactNode } from 'react';

/** Espaço reservado enquanto uma seção abaixo da dobra carrega (mesmo tom dos cartões, sem pular o layout). */
export function SectionSkeleton({ height = 'h-28' }: { height?: string }) {
  return <div aria-hidden="true" className={`${height} animate-pulse rounded-[20px] bg-papel-2`} />;
}

/**
 * Espera uma promise já iniciada e desenha o resultado. Serve com <Suspense>: a página começa a streamar o que já
 * tem e esta seção chega depois, em vez de a tela inteira esperar o mais lento dos pedidos.
 * Server Component: `children` é função, então só funciona entre componentes de servidor.
 */
export async function Await<T>({ promise, children }: { promise: Promise<T>; children: (value: T) => ReactNode }) {
  return <>{children(await promise)}</>;
}

/**
 * Marca a promise como "tratada" sem mudar o resultado: se a página aborta antes de chegar no <Await> (ex.: redirect de
 * sessão vencida lançado por outro pedido), a rejeição dela não vira unhandledRejection. O <Await> ainda a recebe.
 */
export function startEarly<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}
