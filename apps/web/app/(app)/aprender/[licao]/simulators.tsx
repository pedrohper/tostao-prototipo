'use client';
import { useState } from 'react';
import { TAXAS_REFERENCIA } from '@tostao/contracts';
import { money } from '@/lib/format';
import { CompensaParcelar } from '@/components/juros';

// Simuladores interativos.
// Cada um novo entra aqui com o id da lição.
export const SIMULATORS: Record<string, () => React.ReactNode> = {
  'm1-l1': RaloDoCafezinho,
  'm1-l2': AjusteDasFatias,
  'm1-l3': BisturiNoFixo,
  'm1-l4': RemanejamentoEmergencia,
  'm1-l5': DetectorGatilhos,
  'm2-l3': () => <CompensaParcelar taxas={TAXAS_REFERENCIA} compacto />,
};

/** Lição 1: O ralo do cafezinho */
function RaloDoCafezinho() {
  const [valor, setValor] = useState(20);
  const [vezes, setVezes] = useState(4);
  const porSemana = valor * vezes * 100;
  const tres = Math.round(porSemana * 13);
  const ano = Math.round(porSemana * 52);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Cada gastinho</span>
          <span>{money(valor * 100)}</span>
        </span>
        <input
          type="range"
          min={10}
          max={30}
          value={valor}
          onChange={(e) => setValor(+e.target.value)}
          className="accent-[#FF5A36]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Vezes por semana</span>
          <span>{vezes}x</span>
        </span>
        <input
          type="range"
          min={1}
          max={7}
          value={vezes}
          onChange={(e) => setVezes(+e.target.value)}
          className="accent-[#FF5A36]"
        />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold">Em 3 meses</span>
          <p className="font-display text-2xl font-extrabold">{money(tres)}</p>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold">Em 1 ano</span>
          <p className="font-display text-2xl font-extrabold">{money(ano)}</p>
        </div>
      </div>
      <p className="text-sm text-tinta-suave">
        Isso dá {(ano / 130790).toFixed(1).replace('.', ',')} salários de R$ 1.307,90 por ano.
      </p>
    </div>
  );
}

/** Lição 2: Ajuste das fatias (50/30/20) */
function AjusteDasFatias() {
  const [renda, setRenda] = useState(2000); // R$
  const [nec, setNec] = useState(55); // %
  const [des, setDes] = useState(30); // %
  const fut = Math.max(0, 100 - nec - des);

  const rendaCents = renda * 100;
  const necCents = Math.round((rendaCents * nec) / 100);
  const desCents = Math.round((rendaCents * des) / 100);
  const futCents = Math.round((rendaCents * fut) / 100);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Sua renda mensal líquida</span>
          <span className="font-display text-base font-extrabold">{money(rendaCents)}</span>
        </span>
        <input
          type="range"
          min={1200}
          max={6000}
          step={100}
          value={renda}
          onChange={(e) => setRenda(+e.target.value)}
          className="accent-[#FF5A36]"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span className="text-tinta">Necessidades (básico)</span>
            <span className="font-bold text-[#D97706]">{nec}% ({money(necCents)})</span>
          </span>
          <input
            type="range"
            min={30}
            max={85}
            value={nec}
            onChange={(e) => {
              const val = +e.target.value;
              setNec(val);
              if (val + des > 100) setDes(100 - val);
            }}
            className="accent-[#D97706]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span className="text-tinta">Desejos (lazer, estilo)</span>
            <span className="font-bold text-[#E11D48]">{des}% ({money(desCents)})</span>
          </span>
          <input
            type="range"
            min={5}
            max={60}
            value={des}
            onChange={(e) => {
              const val = +e.target.value;
              setDes(val);
              if (val + nec > 100) setNec(100 - val);
            }}
            className="accent-[#E11D48]"
          />
        </label>
      </div>

      {/* Barra empilhada representando a pizza */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-tinta-suave">Distribuição da sua pizza:</span>
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
          <div style={{ width: `${nec}%` }} className="bg-[#FFC233] transition-all duration-200" title={`Necessidades: ${nec}%`} />
          <div style={{ width: `${des}%` }} className="bg-[#FFE1E7] transition-all duration-200" title={`Desejos: ${des}%`} />
          <div style={{ width: `${fut}%` }} className="bg-[#3DD6A0] transition-all duration-200" title={`Futuro: ${fut}%`} />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-tinta-suave px-1">
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFC233]" /> Básico {nec}%</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFE1E7]" /> Lazer {des}%</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-[#3DD6A0]" /> Futuro {fut}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-amarelo-claro p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Básico</span>
          <p className="font-display text-sm font-extrabold">{money(necCents)}</p>
        </div>
        <div className="rounded-xl bg-rosa p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Lazer</span>
          <p className="font-display text-sm font-extrabold">{money(desCents)}</p>
        </div>
        <div className="rounded-xl bg-menta-clara p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Futuro</span>
          <p className="font-display text-sm font-extrabold">{money(futCents)}</p>
        </div>
      </div>

      {nec > 65 && (
        <p className="rounded-xl bg-amarelo-claro p-3 text-xs leading-relaxed text-[#92400E]">
          ⚠️ <b>Aperto no essencial:</b> quando as necessidades passam de 65%, a margem de manobra diminui. Proteja o futuro com ao menos 5% e enxugue os desejos para não entrar no rotativo.
        </p>
      )}
      {fut === 0 && (
        <p className="rounded-xl bg-rosa p-3 text-xs leading-relaxed text-[#9F1239]">
          🚨 <b>Futuro zerado:</b> o básico e o lazer engoliram 100% da renda. Qualquer imprevisto vai virar dívida no cartão. Puxe um pouco dos desejos para abrir espaço para o seu colchão.
        </p>
      )}
      {nec <= 65 && fut >= 15 && (
        <p className="rounded-xl bg-menta-clara p-3 text-xs leading-relaxed text-[#065F46]">
          ✨ <b>Equilíbrio saudável:</b> você cobre o custo de vida, aproveita o momento com lazer e ainda guarda {money(futCents)} todo mês para seu futuro.
        </p>
      )}
    </div>
  );
}

/** Lição 3: O bisturi no fixo */
function BisturiNoFixo() {
  const [cortados, setCortados] = useState<Record<string, boolean>>({
    celular: true,
    academia: false,
    streaming1: false,
    musica: false,
    internet: false,
  });

  const ITENS = [
    { id: 'celular', label: 'Plano celular pós-pago (renegociar p/ controle)', mensal: 4500 },
    { id: 'streaming1', label: 'Streaming extra que você mal abre', mensal: 3990 },
    { id: 'academia', label: 'Academia não utilizada no mês', mensal: 8990 },
    { id: 'musica', label: 'Plano de música individual (mudar p/ família)', mensal: 1500 },
    { id: 'internet', label: 'Internet em velocidade acima da necessária', mensal: 4000 },
  ];

  const totalMensal = ITENS.reduce((acc, it) => acc + (cortados[it.id] ? it.mensal : 0), 0);
  const totalAnual = totalMensal * 12;

  const toggle = (id: string) => {
    setCortados((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs text-tinta-suave">
        Selecione quais gastos fixos você toparia cortar ou renegociar para passar o bisturi:
      </p>

      <div className="flex flex-col gap-2">
        {ITENS.map((it) => {
          const ativo = Boolean(cortados[it.id]);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              className={`flex items-center justify-between rounded-xl border-[1.5px] p-3 text-left transition ${
                ativo ? 'border-menta bg-menta-clara/40' : 'border-linha bg-cartao'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    ativo ? 'border-menta bg-menta text-tinta font-bold' : 'border-linha bg-cartao'
                  }`}
                >
                  {ativo ? '✓' : ''}
                </span>
                <span className={`text-xs font-semibold ${ativo ? 'line-through text-tinta-suave' : 'text-tinta'}`}>
                  {it.label}
                </span>
              </div>
              <span className="shrink-0 font-display text-xs font-extrabold text-tinta">
                {money(it.mensal)}/mês
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-tinta-suave">Alívio todo mês</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{money(totalMensal)}</p>
        </div>
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Guardado em 1 ano</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{money(totalAnual)}</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        {totalMensal > 0 ? (
          <>
            💡 <b>Poder do fixo:</b> cancelar ou renegociar dá trabalho uma única vez, mas o alívio de <b>{money(totalMensal)}</b> cai na sua conta todo mês no piloto automático.
          </>
        ) : (
          'Toque nas opções acima para ver o impacto no ano.'
        )}
      </p>
    </div>
  );
}

/** Lição 4: Remanejamento de emergência */
function RemanejamentoEmergencia() {
  const ALVO = 20000; // R$ 200 de imprevisto

  const [delivery, setDelivery] = useState(60); // R$
  const [role, setRole] = useState(70); // R$
  const [compras, setCompras] = useState(40); // R$
  const [uber, setUber] = useState(30); // R$

  const totalCortes = (delivery + role + compras + uber) * 100;
  const reequilibrado = totalCortes >= ALVO;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between rounded-xl bg-rosa p-3">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9F1239]">Susto inesperado</span>
          <span className="text-sm font-semibold text-tinta">Conserto urgente na oficina / farmácia</span>
        </div>
        <span className="font-display text-lg font-extrabold text-[#9F1239]">{money(ALVO)}</span>
      </div>

      <p className="text-xs text-tinta-suave">
        Ajuste quanto você vai enxugar nas outras categorias até o fim do mês para cobrir o susto sem pagar juros:
      </p>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Delivery & lanches</span>
            <span className="font-bold text-tinta">−{money(delivery * 100)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={120}
            step={10}
            value={delivery}
            onChange={(e) => setDelivery(+e.target.value)}
            className="accent-[#FF5A36]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Rolê do fim de semana</span>
            <span className="font-bold text-tinta">−{money(role * 100)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={120}
            step={10}
            value={role}
            onChange={(e) => setRole(+e.target.value)}
            className="accent-[#FF5A36]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Roupas & comprinhas</span>
            <span className="font-bold text-tinta">−{money(compras * 100)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={compras}
            onChange={(e) => setCompras(+e.target.value)}
            className="accent-[#FF5A36]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Uber & caronas pagas</span>
            <span className="font-bold text-tinta">−{money(uber * 100)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={80}
            step={10}
            value={uber}
            onChange={(e) => setUber(+e.target.value)}
            className="accent-[#FF5A36]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold">
          <span>Total remanejado:</span>
          <span className={`font-bold ${reequilibrado ? 'text-[#065F46]' : 'text-[#9F1239]'}`}>
            {money(totalCortes)} de {money(ALVO)}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
          <div
            style={{ width: `${Math.min(100, Math.round((totalCortes / ALVO) * 100))}%` }}
            className={`h-full transition-all duration-200 ${reequilibrado ? 'bg-menta' : 'bg-laranja'}`}
          />
        </div>
      </div>

      {reequilibrado ? (
        <div className="rounded-xl bg-menta-clara p-3 text-xs leading-relaxed text-[#065F46]">
          🎉 <b>Mês reequilibrado!</b> Você cobriu os R$ 200 remanejando gastos flexíveis. O dinheiro saiu das suas escolhas conscientes, e você não pagou um real de juros pro rotativo.
        </div>
      ) : (
        <div className="rounded-xl bg-amarelo-claro p-3 text-xs leading-relaxed text-[#92400E]">
          ⏳ <b>Ainda faltam {money(ALVO - totalCortes)}:</b> se não compensar esse valor nas próximas semanas, ele vira fatura atrasada ou cheque especial. Aumente o corte em alguma categoria!
        </div>
      )}
    </div>
  );
}

/** Lição 5: Detector de gatilhos */
function DetectorGatilhos() {
  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const [gatilhos, setGatilhos] = useState<string[]>(['Qui', 'Sex', 'Sáb']);
  const [trocas, setTrocas] = useState(2); // Quantos dias substitui por comida caseira / marmita
  const ECONOMIA_REFEICAO = 2500; // R$ 25 de economia por troca

  const toggleDia = (d: string) => {
    setGatilhos((prev) => {
      const next = prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d];
      if (trocas > next.length) setTrocas(Math.max(1, next.length));
      return next;
    });
  };

  const maxTrocas = Math.max(1, gatilhos.length);
  const diasTrocados = Math.min(trocas, maxTrocas);

  const porSemana = diasTrocados * ECONOMIA_REFEICAO;
  const porMes = Math.round(porSemana * 4.33);
  const porAno = porSemana * 52;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-tinta">
          Quais dias você mais pede delivery ou come na rua por cansaço?
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d) => {
            const ativo = gatilhos.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDia(d)}
                className={`flex h-9 min-w-[42px] items-center justify-center rounded-xl px-2.5 text-xs font-bold transition ${
                  ativo ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs font-semibold text-tinta">
          <span>Trocar por marmita / comida em casa:</span>
          <span className="font-bold text-laranja">{diasTrocados} dia{diasTrocados > 1 ? 's' : ''}/semana</span>
        </span>
        <input
          type="range"
          min={1}
          max={maxTrocas}
          value={diasTrocados}
          onChange={(e) => setTrocas(+e.target.value)}
          className="accent-[#FF5A36]"
        />
        <span className="text-[11px] text-tinta-suave">
          Economia estimada de {money(ECONOMIA_REFEICAO)} por refeição preparada em casa.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Economia no mês</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{money(porMes)}</p>
        </div>
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-tinta-suave">Economia em 1 ano</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{money(porAno)}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        🎯 <b>A regra não é sofrer:</b> você não precisa cozinhar os 7 dias da semana. Trocar apenas{' '}
        <b>{diasTrocados} refeição{diasTrocados > 1 ? 'ões' : ''}</b> por comida congelada ou simples já injeta{' '}
        <b>{money(porAno)}</b> na sua reserva anual.
      </p>
    </div>
  );
}
