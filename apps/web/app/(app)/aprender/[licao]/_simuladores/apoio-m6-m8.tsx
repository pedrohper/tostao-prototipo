'use client';
// Apoio de tela dos simuladores dos módulos 6 a 8, pra caber em 320 px.
import { Quadros, type Quadro } from '@/components/simulador-campos';

/**
 * O cartão grande usa letra de 36 px até 16 caracteres, e em 320 px um valor com 12 ou mais ("R$ 16.800,00") não cabe:
 * sairia partido no meio. Com o complemento o texto vai pra letra menor e quebra no espaço.
 */
export const valorQueCabe = (valor: string, complemento: string) =>
  valor.length >= 12 ? `${valor} ${complemento}` : valor;

/**
 * Quadros um por linha. Com exatamente dois itens o `Quadros` os põe lado a lado,
 * e em 320 px um valor tipo "R$ 80.640,00" (que não quebra entre o R$ e o número) sairia partido no meio.
 */
export function QuadrosEmLinhas({ itens }: { itens: readonly Quadro[] }) {
  return (
    <div className="flex flex-col gap-2">
      {itens.map((item) => (
        <Quadros key={item.rotulo} itens={[item]} />
      ))}
    </div>
  );
}
