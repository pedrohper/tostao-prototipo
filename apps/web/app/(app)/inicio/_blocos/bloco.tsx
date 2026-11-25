// Moldura de um bloco da Home que chega depois do saldo (T6.9).
import { Suspense, type ReactNode } from 'react';
import { SectionSkeleton } from '@/components/suspense';

/**
 * `skeleton` = classes de altura do esqueleto, medidas no bloco já pronto pra tela não pular. Sem ele, nada aparece
 * enquanto carrega: é o certo pro bloco que pode não ter o que mostrar (um aviso, por exemplo).
 */
export function Block({ skeleton, children }: { skeleton?: string; children: ReactNode }) {
  return <Suspense fallback={skeleton ? <SectionSkeleton height={skeleton} /> : null}>{children}</Suspense>;
}
