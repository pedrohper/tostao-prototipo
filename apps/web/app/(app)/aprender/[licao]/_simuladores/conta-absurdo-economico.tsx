'use client';
// m9-l5: A conta do absurdo econômico, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoOpcoes, Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type AbsurdoEntrada = { porVideoCents: number; minutosDia: number; usuarios: number };

export function calcularContaDoAbsurdo({ porVideoCents, minutosDia, usuarios }: AbsurdoEntrada) {
  const videosDia = minutosDia * 2; // 30s por vídeo
  const custoDiaCents = videosDia * porVideoCents * usuarios;
  return { videosDia, custoDiaCents, custoMesCents: custoDiaCents * 30 };
}

/** Valores enormes por extenso: "R$ 900,00 milhões" (e no singular abaixo de 2: "R$ 1,50 milhão"). */
export function formatCompactMoney(reais: number): string {
  if (!Number.isFinite(reais) || reais >= 1e15) return 'R$ ∞ (astronômico)';
  const escala = (divisor: number, um: string, varios: string) => {
    const quanto = (reais / divisor).toFixed(2);
    return `R$ ${quanto.replace('.', ',')} ${Number(quanto) < 2 ? um : varios}`;
  };
  if (reais >= 1e12) return escala(1e12, 'trilhão', 'trilhões');
  if (reais >= 1e9) return escala(1e9, 'bilhão', 'bilhões');
  if (reais >= 1e6) return escala(1e6, 'milhão', 'milhões');
  return money(Math.round(reais * 100));
}

const compacto = (cents: number) => formatCompactMoney(cents / 100);

export type PalpiteDoAbsurdo = 'menor' | 'meio' | 'maior';

/** As faixas do palpite crescem com a plataforma: R$ 1.000 e R$ 5.000 por usuário no mês. */
export const faixasDoAbsurdo = (usuarios: number) => ({
  baixoCents: usuarios * 100_000,
  altoCents: usuarios * 500_000,
});

export function palpiteCertoDoAbsurdo(usuarios: number, custoMesCents: number): PalpiteDoAbsurdo {
  const { baixoCents, altoCents } = faixasDoAbsurdo(usuarios);
  if (custoMesCents <= baixoCents) return 'menor';
  return custoMesCents <= altoCents ? 'meio' : 'maior';
}

const PLATAFORMAS = [
  { id: 10_000, rotulo: '10 mil' },
  { id: 100_000, rotulo: '100 mil' },
  { id: 1_000_000, rotulo: '1 milhão' },
];

export function ContaAbsurdoEconomico() {
  const [porVideo, setPorVideo] = useState(500);
  const [minutosDia, setMinutosDia] = useState(30);
  const [usuarios, setUsuarios] = useState(100_000);

  const { videosDia, custoDiaCents, custoMesCents } = calcularContaDoAbsurdo({
    porVideoCents: porVideo,
    minutosDia,
    usuarios,
  });
  const faixas = faixasDoAbsurdo(usuarios);
  const plataforma = PLATAFORMAS.find((p) => p.id === usuarios)!.rotulo;

  return (
    <SimuladorShell
      pergunta="Se pagasse mesmo, quanto essa empresa gastaria por mês?"
      cenario={[
        { rotulo: 'Prometem por vídeo de 30s', valor: money(porVideo) },
        { rotulo: 'Cada pessoa assiste por dia', valor: `${videosDia} vídeos` },
        { rotulo: 'Usuários na plataforma', valor: plataforma },
      ]}
      palpites={[
        { id: 'menor', rotulo: `Até ${compacto(faixas.baixoCents)}` },
        { id: 'meio', rotulo: `Entre ${compacto(faixas.baixoCents)} e ${compacto(faixas.altoCents)}` },
        { id: 'maior', rotulo: `Mais de ${compacto(faixas.altoCents)}` },
      ]}
      resultado={{
        rotulo: 'Custo por mês',
        valor: compacto(custoMesCents),
        tom: 'ruim',
        custoMesCents,
      }}
      respostaCerta={(r) => palpiteCertoDoAbsurdo(usuarios, r.custoMesCents)}
      explicacao={
        <p>
          <Selo tipo="dinheiro" />
          Um anunciante real paga ~R$ 0,03 por visualização. Pagar {money(porVideo)} por vídeo exigiria que a empresa
          queimasse <b>{compacto(custoMesCents)}</b> todo mês — a conta não fecha!
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Valor prometido por vídeo de 30s"
          valor={porVideo}
          min={100}
          max={1_500}
          passo={100}
          onChange={setPorVideo}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`${minutosDia} min por dia (${videosDia} vídeos) · usuários: ${plataforma}`}
      extras={
        <>
          <div className="flex flex-col gap-1">
            <CampoRegua
              rotulo="Minutos assistidos por dia"
              valor={minutosDia}
              min={10}
              max={120}
              passo={10}
              onChange={setMinutosDia}
              formatar={(v) => `${v} min`}
            />
            <span className="text-[13px] text-tinta-suave">São {videosDia} vídeos de 30s por dia</span>
          </div>
          <CampoOpcoes rotulo="Usuários na plataforma" opcoes={PLATAFORMAS} valor={usuarios} onChange={setUsuarios} />
        </>
      }
      detalhes={<Quadros itens={[{ rotulo: 'Custo por dia', valor: compacto(custoDiaCents), tom: 'atencao' }]} />}
    />
  );
}
