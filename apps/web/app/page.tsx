import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { Landing } from './(site)/landing';

export const metadata: Metadata = {
  title: 'Tostão: grana explicada, de tostão em tostão',
  description: 'Conecte seu banco, veja pra onde o dinheiro foi e aprenda com os seus próprios gastos, em lições de 2 minutos. Sem sermão. Grátis pra começar.',
  openGraph: {
    title: 'Tostão: grana explicada, de tostão em tostão',
    description: 'Finanças pessoais e educação financeira pra quem tem de 18 a 25 anos. Sem sermão.',
    images: ['/elenco/acenando.webp'],
    locale: 'pt_BR',
    type: 'website',
  },
};

// Quem já tem sessão vai direto pro app; quem não tem vê a landing.
export default async function Root({ searchParams }: { searchParams: Promise<{ conta?: string }> }) {
  if (await getToken()) redirect('/inicio');
  const { conta } = await searchParams;
  return <Landing contaApagada={conta === 'apagada'} />;
}
