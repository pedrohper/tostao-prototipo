'use client';
import { useState } from 'react';
import { money } from '@/lib/format';

// Simuladores interativos dos Módulos 2, 3, 4 e 5.
export const SIMULATORS_M2_M5: Record<string, () => React.ReactNode> = {
  'm2-l1': IlusaoDePoder,
  'm2-l2': BolaDeNeveDoMinimo,
  'm2-l4': RaioXDoCetNoPix,
  'm2-l5': ReguaDeDatas,
  'm3-l1': TermometroDeSangria,
  'm3-l2': AvalancheVsBolaDeNeve,
  'm3-l3': CalculadoraValorOriginal,
  'm3-l4': SimuladorDesenrolaSerasa,
  'm3-l5': CalculadoraMinimoExistencial,
  'm4-l1': CalculadoraCustoBasico,
  'm4-l2': ComparadorLiquidezSeguranca,
  'm4-l3': SemaforoDaEmergencia,
  'm4-l4': ReconstrucaoDoMuro,
  'm4-l5': TermometroPazDeEspirito,
  'm5-l1': AportesVsAumentoDeRenda,
  'm5-l2': CalculadoraRoiEducacional,
  'm5-l3': BalancoDoEstagio,
  'm5-l4': CalculadoraHoraDeFreela,
  'm5-l5': AlocacaoRendaExtra,
};

/* ============================================================================
 * MÓDULO 2 — CARTÃO DE CRÉDITO
 * ========================================================================== */

/** m2-l1: Ilusão de poder */
function IlusaoDePoder() {
  const [limite, setLimite] = useState(3500);
  const [renda, setRenda] = useState(2200);

  const limiteCents = limite * 100;
  const rendaCents = renda * 100;
  const diariaCents = Math.round(rendaCents / 22);
  const diasTrabalho = Math.round((limite / renda) * 22);
  const multiplo = limite / renda;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Limite do cartão</span>
          <span className="font-display font-extrabold">{money(limiteCents)}</span>
        </span>
        <input
          type="range"
          min={500}
          max={15000}
          step={250}
          value={limite}
          onChange={(e) => setLimite(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Sua renda mensal real</span>
          <span className="font-display font-extrabold">{money(rendaCents)}</span>
        </span>
        <input
          type="range"
          min={1200}
          max={10000}
          step={100}
          value={renda}
          onChange={(e) => setRenda(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-tinta-suave">Dias de trabalho p/ quitar</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{diasTrabalho} dias</p>
        </div>
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Valor do seu dia útil</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{money(diariaCents)}</p>
        </div>
      </div>

      <p
        className={`rounded-xl p-3 text-xs leading-relaxed ${
          multiplo > 1 ? 'bg-rosa text-vermelho-texto' : 'bg-menta-clara text-verde-texto'
        }`}
      >
        {multiplo > 1 ? (
          <>
            ⚠️ <b>Armadilha do limite alto:</b> seu limite equivale a <b>{multiplo.toFixed(1).replace('.', ',')}x</b> a
            sua renda mensal. Estourar o cartão significa trabalhar <b>{diasTrabalho} dias úteis inteiros</b> (base 22
            dias/mês) só para empatar — sem contar os juros.
          </>
        ) : (
          <>
            ✅ <b>Limite sob controle:</b> seu limite representa <b>{Math.round(multiplo * 100)}%</b> da sua renda
            mensal ({diasTrabalho} dias úteis). Mesmo assim, limite não é extensão do salário.
          </>
        )}
      </p>
    </div>
  );
}

/** m2-l2: A bola de neve do mínimo */
function BolaDeNeveDoMinimo() {
  const [faturaInicial, setFaturaInicial] = useState(800);
  const [pctMinimo, setPctMinimo] = useState(15);
  const [taxaMensal, setTaxaMensal] = useState(14.5); // ~14% rotativo + IOF

  const faturaCents = faturaInicial * 100;
  const tetoLeiCents = faturaCents * 2; // Lei 14.690/2023: juros + encargos limitados a 100% do principal

  const projetar = (meses: number) => {
    let saldo = faturaCents;
    let totalPago = 0;
    let bateuTeto = false;

    for (let m = 1; m <= meses; m++) {
      const pagamentoMin = Math.round((saldo * pctMinimo) / 100);
      totalPago += pagamentoMin;
      const restante = Math.max(0, saldo - pagamentoMin);
      const comJuros = Math.round(restante * (1 + taxaMensal / 100));
      if (totalPago + comJuros >= tetoLeiCents) {
        saldo = Math.max(0, tetoLeiCents - totalPago);
        bateuTeto = true;
      } else {
        saldo = comJuros;
      }
    }

    return { saldo, totalPago, totalGeral: totalPago + saldo, bateuTeto };
  };

  const marcos = [1, 3, 6, 12].map((m) => ({ mes: m, ...projetar(m) }));
  const m12 = marcos[3];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Fatura inicial no rotativo</span>
          <span className="font-display font-extrabold">{money(faturaCents)}</span>
        </span>
        <input
          type="range"
          min={200}
          max={4000}
          step={50}
          value={faturaInicial}
          onChange={(e) => setFaturaInicial(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Pagamento mínimo</span>
            <span className="font-bold">{pctMinimo}%</span>
          </span>
          <input
            type="range"
            min={15}
            max={40}
            step={5}
            value={pctMinimo}
            onChange={(e) => setPctMinimo(+e.target.value)}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Rotativo + IOF/mês</span>
            <span className="font-bold">{taxaMensal.toFixed(1).replace('.', ',')}%</span>
          </span>
          <input
            type="range"
            min={10}
            max={18}
            step={0.5}
            value={taxaMensal}
            onChange={(e) => setTaxaMensal(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {marcos.map((item) => (
          <div key={item.mes} className="rounded-2xl bg-papel-2 border border-linha p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-tinta-suave">Mês {item.mes}</span>
              {item.bateuTeto && (
                <span className="rounded-full bg-rosa px-1.5 py-0.5 text-[10px] font-bold text-vermelho-texto">
                  Teto 100%
                </span>
              )}
            </div>
            <p className="font-display text-lg font-extrabold text-tinta mt-0.5">{money(item.saldo)}</p>
            <span className="text-[11px] text-tinta-suave block">Já pago: {money(item.totalPago)}</span>
          </div>
        ))}
      </div>

      <p className="rounded-xl bg-amarelo-claro p-3 text-xs leading-relaxed text-laranja-texto">
        ⚖️ <b>Lei 14.690/2023 (Teto de 100%):</b> os juros do rotativo não podem passar do dobro da dívida original (
        {money(tetoLeiCents)}). Em 12 meses pagando só o mínimo, você já terá desembolsado <b>{money(m12.totalPago)}</b>{' '}
        e ainda deverá <b>{money(m12.saldo)}</b>.
      </p>
    </div>
  );
}

/** m2-l4: Raio-x do CET no Pix */
function RaioXDoCetNoPix() {
  const [valorPix, setValorPix] = useState(500);
  const [parcelas, setParcelas] = useState(6);
  const [valorParcela, setValorParcela] = useState(98);

  const valorCents = valorPix * 100;
  const parcelaCents = valorParcela * 100;
  const totalPagoCents = parcelaCents * parcelas;
  const jurosCents = totalPagoCents - valorCents;

  // Bissecção simples para achar taxa mensal implícita i em PV = PMT * (1 - (1+i)^-n) / i
  const calcularTaxaMensal = (): number => {
    if (totalPagoCents <= valorCents || parcelas <= 0) return 0;
    let low = 0.00001;
    let high = 2.0;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (low + high) / 2;
      const pv = parcelaCents * ((1 - Math.pow(1 + mid, -parcelas)) / mid);
      if (pv > valorCents) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return ((low + high) / 2) * 100;
  };

  const taxaMensalPct = calcularTaxaMensal();
  const taxaAnualPct = (Math.pow(1 + taxaMensalPct / 100, 12) - 1) * 100;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Valor do Pix à vista</span>
          <span className="font-display font-extrabold">{money(valorCents)}</span>
        </span>
        <input
          type="range"
          min={100}
          max={3000}
          step={50}
          value={valorPix}
          onChange={(e) => {
            const v = +e.target.value;
            setValorPix(v);
            const minParcela = Math.ceil(v / parcelas);
            if (valorParcela < minParcela) setValorParcela(minParcela);
          }}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Parcelas</span>
            <span className="font-bold">{parcelas}x</span>
          </span>
          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={parcelas}
            onChange={(e) => {
              const n = +e.target.value;
              setParcelas(n);
              const sugestao = Math.ceil((valorPix * 1.15) / n);
              setValorParcela(sugestao);
            }}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Parcela do banco</span>
            <span className="font-bold">{money(parcelaCents)}</span>
          </span>
          <input
            type="range"
            min={Math.max(10, Math.floor(valorPix / parcelas))}
            max={Math.ceil((valorPix * 1.8) / parcelas) + 50}
            step={2}
            value={valorParcela}
            onChange={(e) => setValorParcela(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-papel-2 border border-linha p-3">
          <span className="text-xs font-semibold text-tinta-suave">Total pago no Pix</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(totalPagoCents)}</p>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-tinta-suave">Juros embutidos</span>
          <p className="font-display text-xl font-extrabold text-vermelho-texto">
            {jurosCents > 0 ? money(jurosCents) : money(0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Taxa mensal implícita</span>
          <p className="font-display text-lg font-extrabold text-tinta">
            {taxaMensalPct.toFixed(2).replace('.', ',')}% a.m.
          </p>
        </div>
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">CET anual equivalente</span>
          <p className="font-display text-lg font-extrabold text-tinta">{taxaAnualPct.toFixed(0)}% a.a.</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        {taxaMensalPct >= 4 ? (
          <>
            🚨 <b>Pix parcelado caro:</b> o banco está cobrando{' '}
            <b>{taxaMensalPct.toFixed(1).replace('.', ',')}% ao mês</b> escondido na parcela. Só faça se for emergência
            real e sem alternativa à vista.
          </>
        ) : (
          <>
            💡 <b>Compare sempre pelo CET:</b> mesmo parcelas pequenas somam juros altos no fim do contrato.
          </>
        )}
      </p>
    </div>
  );
}

/** m2-l5: Régua de datas */
function ReguaDeDatas() {
  const [fechamento, setFechamento] = useState(10);
  const [vencimento, setVencimento] = useState(17);
  const [compra, setCompra] = useState(11);

  const caiNaProxima = compra >= fechamento;
  const gapFechVenc = vencimento >= fechamento ? vencimento - fechamento : 30 - fechamento + vencimento;
  const diasFolego = caiNaProxima ? 30 - compra + fechamento + gapFechVenc : fechamento - compra + gapFechVenc;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Fechamento</span>
            <span className="font-bold">Dia {fechamento}</span>
          </span>
          <input
            type="range"
            min={1}
            max={28}
            value={fechamento}
            onChange={(e) => setFechamento(+e.target.value)}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Vencimento</span>
            <span className="font-bold">Dia {vencimento}</span>
          </span>
          <input
            type="range"
            min={1}
            max={28}
            value={vencimento}
            onChange={(e) => setVencimento(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Dia da compra no mês</span>
          <span className="font-display font-extrabold">Dia {compra}</span>
        </span>
        <input
          type="range"
          min={1}
          max={30}
          value={compra}
          onChange={(e) => setCompra(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className={`rounded-2xl p-3 ${caiNaProxima ? 'bg-menta-clara' : 'bg-amarelo-claro'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Em qual fatura cai</span>
          <p className="font-display text-lg font-extrabold text-tinta mt-0.5">
            {caiNaProxima ? 'Próxima fatura' : 'Fatura atual'}
          </p>
        </div>
        <div className="rounded-2xl bg-azul p-3">
          <span className="text-xs font-semibold text-tinta-suave">Fôlego até pagar</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{diasFolego} dias</p>
        </div>
      </div>

      <p
        className={`rounded-xl p-3 text-xs leading-relaxed ${
          caiNaProxima ? 'bg-menta-clara text-verde-texto' : 'bg-amarelo-claro text-laranja-texto'
        }`}
      >
        {caiNaProxima ? (
          <>
            🎯 <b>Melhor janela de compra:</b> comprando a partir do dia {fechamento} (fechamento), você ganha{' '}
            <b>{diasFolego} dias</b> de fôlego antes do vencimento no dia {vencimento} do próximo ciclo.
          </>
        ) : (
          <>
            ⏳ <b>Cai nesta fatura:</b> como você comprou antes do fechamento (dia {fechamento}), a cobrança já vem no
            vencimento próximo (dia {vencimento}), em apenas <b>{diasFolego} dias</b>.
          </>
        )}
      </p>
    </div>
  );
}

/* ============================================================================
 * MÓDULO 3 — SAINDO DAS DÍVIDAS
 * ========================================================================== */

/** m3-l1: Termômetro de sangria */
function TermometroDeSangria() {
  const [dividas, setDividas] = useState([
    { id: 'rotativo', nome: 'Cartão rotativo', saldo: 1500, taxa: 14, ativa: true },
    { id: 'cheque', nome: 'Cheque especial', saldo: 1000, taxa: 8, ativa: true },
    { id: 'emprestimo', nome: 'Empréstimo pessoal', saldo: 2500, taxa: 4, ativa: true },
  ]);

  const atualizar = (id: string, patch: Partial<(typeof dividas)[number]>) => {
    setDividas((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const ativasOrdenadas = [...dividas].filter((d) => d.ativa).sort((a, b) => b.taxa - a.taxa);

  const jurosTotalMesCents = ativasOrdenadas.reduce((acc, d) => acc + Math.round(d.saldo * 100 * (d.taxa / 100)), 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        {dividas.map((d) => {
          const mesesDobra = d.taxa > 0 ? Math.log(2) / Math.log(1 + d.taxa / 100) : Infinity;
          return (
            <div
              key={d.id}
              className={`rounded-xl border-[1.5px] p-3 transition ${
                d.ativa ? 'border-linha bg-cartao' : 'border-linha bg-papel-2 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => atualizar(d.id, { ativa: !d.ativa })}
                  className="flex items-center gap-2 text-left"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                      d.ativa ? 'border-menta bg-menta text-tinta' : 'border-linha bg-cartao'
                    }`}
                  >
                    {d.ativa ? '✓' : ''}
                  </span>
                  <span className="text-xs font-bold text-tinta">{d.nome}</span>
                </button>
                <span className="rounded-full bg-rosa px-2 py-0.5 text-[11px] font-bold text-vermelho-texto">
                  {d.taxa}%/mês · dobra em {mesesDobra.toFixed(1).replace('.', ',')}m
                </span>
              </div>

              {d.ativa && (
                <div className="mt-2.5 flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-semibold text-tinta-suave">
                    <span>Saldo: {money(d.saldo * 100)}</span>
                    <span>Sangria: {money(Math.round(d.saldo * 100 * (d.taxa / 100)))}/mês</span>
                  </div>
                  <input
                    type="range"
                    min={300}
                    max={6000}
                    step={100}
                    value={d.saldo}
                    onChange={(e) => atualizar(d.id, { saldo: +e.target.value })}
                    className="accent-laranja"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-rosa p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-vermelho-texto">Sangria mensal total em juros</span>
        <span className="font-display text-xl font-extrabold text-vermelho-texto">{money(jurosTotalMesCents)}/mês</span>
      </div>

      {ativasOrdenadas.length > 0 && (
        <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
          🔥 <b>Ordem de ataque (da mais cara p/ mais barata):</b>{' '}
          {ativasOrdenadas.map((d, i) => `${i + 1}º ${d.nome} (${d.taxa}%)`).join(' → ')}.
        </p>
      )}
    </div>
  );
}

/** m3-l2: Avalanche vs. Bola de neve */
function AvalancheVsBolaDeNeve() {
  const [metodo, setMetodo] = useState<'avalanche' | 'bola'>('avalanche');
  const [extra, setExtra] = useState(250);

  type DividaBase = { id: string; nome: string; saldo: number; taxa: number; min: number };
  const BASE: DividaBase[] = [
    { id: 'cartao', nome: 'Cartão (14%/m)', saldo: 180000, taxa: 0.14, min: 27000 },
    { id: 'carne', nome: 'Loja/Carnê (6%/m)', saldo: 60000, taxa: 0.06, min: 9000 },
    { id: 'emp', nome: 'Empréstimo (3,5%/m)', saldo: 300000, taxa: 0.035, min: 20000 },
  ];

  const simular = (estrategia: 'avalanche' | 'bola') => {
    const itens = BASE.map((d) => ({ ...d }));
    let totalJuros = 0;
    let meses = 0;
    let primeiraQuitadaMes = 0;
    const extraCents = extra * 100;

    while (itens.some((d) => d.saldo > 0) && meses < 120) {
      meses++;
      // Aplica juros do mês
      for (const d of itens) {
        if (d.saldo > 0) {
          const juro = Math.round(d.saldo * d.taxa);
          d.saldo += juro;
          totalJuros += juro;
        }
      }

      // Paga mínimos
      let sobra = extraCents;
      for (const d of itens) {
        if (d.saldo > 0) {
          const pag = Math.min(d.saldo, d.min);
          d.saldo -= pag;
          if (pag < d.min) sobra += d.min - pag;
        } else {
          sobra += d.min;
        }
      }

      // Direciona aporte extra pela estratégia
      const ativas = itens.filter((d) => d.saldo > 0);
      ativas.sort((a, b) => (estrategia === 'avalanche' ? b.taxa - a.taxa : a.saldo - b.saldo));

      for (const alvo of ativas) {
        if (sobra <= 0) break;
        const pag = Math.min(alvo.saldo, sobra);
        alvo.saldo -= pag;
        sobra -= pag;
      }

      if (primeiraQuitadaMes === 0 && itens.some((d) => d.saldo === 0)) {
        primeiraQuitadaMes = meses;
      }
    }

    return { totalJuros, meses, primeiraQuitadaMes };
  };

  const resAvalanche = simular('avalanche');
  const resBola = simular('bola');
  const atual = metodo === 'avalanche' ? resAvalanche : resBola;
  const economiaAvalanche = resBola.totalJuros - resAvalanche.totalJuros;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMetodo('avalanche')}
          className={`rounded-xl border-[1.5px] p-2.5 text-xs font-bold transition ${
            metodo === 'avalanche'
              ? 'border-menta bg-menta-clara text-tinta'
              : 'border-linha bg-cartao text-tinta-suave'
          }`}
        >
          🏔️ Avalanche (maior juro)
        </button>
        <button
          type="button"
          onClick={() => setMetodo('bola')}
          className={`rounded-xl border-[1.5px] p-2.5 text-xs font-bold transition ${
            metodo === 'bola' ? 'border-menta bg-menta-clara text-tinta' : 'border-linha bg-cartao text-tinta-suave'
          }`}
        >
          ⛄ Bola de neve (menor saldo)
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Aporte extra mensal</span>
          <span className="font-display font-extrabold">{money(extra * 100)}</span>
        </span>
        <input
          type="range"
          min={50}
          max={800}
          step={50}
          value={extra}
          onChange={(e) => setExtra(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">1ª dívida quitada</span>
          <p className="font-display text-2xl font-extrabold text-tinta">
            {atual.primeiraQuitadaMes} {atual.primeiraQuitadaMes === 1 ? 'mês' : 'meses'}
          </p>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-tinta-suave">Total de juros pagos</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(atual.totalJuros)}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        📊 <b>Comparativo ({atual.meses} meses p/ zerar tudo):</b>{' '}
        {economiaAvalanche > 0 ? (
          <>
            a <b>Avalanche</b> economiza <b>{money(economiaAvalanche)}</b> em juros, enquanto a <b>Bola de Neve</b> dá
            vitória rápida na 1ª dívida em <b>{resBola.primeiraQuitadaMes} meses</b>.
          </>
        ) : (
          'Os dois métodos empatam em juros com esse aporte. Escolha o que te der mais fôlego emocional!'
        )}
      </p>
    </div>
  );
}

/** m3-l3: Calculadora do valor original */
function CalculadoraValorOriginal() {
  const [valorHoje, setValorHoje] = useState(4500);
  const [mesesAtraso, setMesesAtraso] = useState(18);
  const [taxaEstimada, setTaxaEstimada] = useState(8);

  const hojeCents = valorHoje * 100;
  const principalCents = Math.round(hojeCents / Math.pow(1 + taxaEstimada / 100, mesesAtraso));
  const jurosAcumuladosCents = Math.max(0, hojeCents - principalCents);
  const ofertaMinCents = Math.round(principalCents * 0.8);
  const ofertaMaxCents = Math.min(hojeCents, Math.round(principalCents * 1.2));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Valor cobrado hoje</span>
          <span className="font-display font-extrabold">{money(hojeCents)}</span>
        </span>
        <input
          type="range"
          min={500}
          max={20000}
          step={250}
          value={valorHoje}
          onChange={(e) => setValorHoje(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Meses em atraso</span>
            <span className="font-bold">{mesesAtraso}m</span>
          </span>
          <input
            type="range"
            min={1}
            max={60}
            value={mesesAtraso}
            onChange={(e) => setMesesAtraso(+e.target.value)}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Taxa estimada</span>
            <span className="font-bold">{taxaEstimada}%/mês</span>
          </span>
          <input
            type="range"
            min={2}
            max={15}
            step={0.5}
            value={taxaEstimada}
            onChange={(e) => setTaxaEstimada(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-tinta-suave">Principal original aprox.</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(principalCents)}</p>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-tinta-suave">Só juros na cobrança</span>
          <p className="font-display text-xl font-extrabold text-vermelho-texto">{money(jurosAcumuladosCents)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-amarelo-claro p-3 text-xs leading-relaxed text-laranja-texto">
        🤝 <b>Faixa de contraoferta realista à vista:</b> entre <b>{money(ofertaMinCents)}</b> e{' '}
        <b>{money(ofertaMaxCents)}</b>. Nunca aceite a primeira proposta parcelada sem saber quanto da dívida é só bola
        de neve.
      </div>
    </div>
  );
}

/** m3-l4: Simulador de proposta do Desenrola/Serasa */
function SimuladorDesenrolaSerasa() {
  const [renda, setRenda] = useState(2200);
  const [parcela, setParcela] = useState(550);

  const pct = (parcela / renda) * 100;
  const risco = pct > 20;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Renda líquida mensal</span>
          <span className="font-display font-extrabold">{money(renda * 100)}</span>
        </span>
        <input
          type="range"
          min={1200}
          max={8000}
          step={100}
          value={renda}
          onChange={(e) => setRenda(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Parcela da renegociação</span>
          <span className="font-display font-extrabold">{money(parcela * 100)}</span>
        </span>
        <input
          type="range"
          min={50}
          max={2000}
          step={25}
          value={parcela}
          onChange={(e) => setParcela(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold">
          <span>Comprometimento da renda</span>
          <span className={`font-bold ${risco ? 'text-vermelho-texto' : 'text-verde-texto'}`}>
            {pct.toFixed(1).replace('.', ',')}% (limite seguro: 20%)
          </span>
        </div>
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
          <div
            style={{ width: `${Math.min(100, Math.round(pct))}%` }}
            className={`h-full transition-all duration-200 ${risco ? 'bg-laranja' : 'bg-menta'}`}
          />
        </div>
      </div>

      <p
        className={`rounded-xl p-3 text-xs leading-relaxed ${
          risco ? 'bg-rosa text-vermelho-texto' : 'bg-menta-clara text-verde-texto'
        }`}
      >
        {risco ? (
          <>
            🚨 <b>Zona de risco de re-inadimplência:</b> comprometer mais de 20% da renda com acordo (
            {money(Math.round(renda * 20))}/mês no máximo) costuma quebrar o combinado no primeiro imprevisto. Peça
            prazo maior ou desconto maior antes de assinar.
          </>
        ) : (
          <>
            ✅ <b>Parcela saudável:</b> cabe dentro dos 20% recomendados da sua renda. Você consegue honrar o acordo sem
            atrasar aluguel, luz ou mercado.
          </>
        )}
      </p>
    </div>
  );
}

/** m3-l5: Calculadora do Mínimo Existencial */
function CalculadoraMinimoExistencial() {
  const [moradia, setMoradia] = useState(750);
  const [alimentacao, setAlimentacao] = useState(550);
  const [basicos, setBasicos] = useState(320); // água, luz, transporte
  const [renda, setRenda] = useState(2000);

  const PISO_LEGAL_CENTS = 60000; // Decreto 11.567/2023 (R$ 600)
  const minimoRealCents = (moradia + alimentacao + basicos) * 100;
  const rendaCents = renda * 100;
  const margemRealCents = rendaCents - minimoRealCents;

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Aluguel / Moradia</span>
          <span className="font-bold">{money(moradia * 100)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={2500}
          step={50}
          value={moradia}
          onChange={(e) => setMoradia(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Alimentação básica</span>
          <span className="font-bold">{money(alimentacao * 100)}</span>
        </span>
        <input
          type="range"
          min={200}
          max={1500}
          step={50}
          value={alimentacao}
          onChange={(e) => setAlimentacao(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Água, luz e transporte</span>
          <span className="font-bold">{money(basicos * 100)}</span>
        </span>
        <input
          type="range"
          min={100}
          max={1000}
          step={20}
          value={basicos}
          onChange={(e) => setBasicos(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Sua renda mensal disponível</span>
          <span className="font-bold">{money(rendaCents)}</span>
        </span>
        <input
          type="range"
          min={1000}
          max={6000}
          step={100}
          value={renda}
          onChange={(e) => setRenda(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Seu mínimo existencial</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(minimoRealCents)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${margemRealCents > 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Sobra p/ negociar</span>
          <p className="font-display text-xl font-extrabold text-tinta">
            {margemRealCents > 0 ? money(margemRealCents) : money(0)}
          </p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        ⚖️ <b>Piso legal vs. vida real:</b> o decreto federal protege pelo menos <b>{money(PISO_LEGAL_CENTS)}</b> da
        renda na Lei do Superendividamento, mas o seu mínimo de sobrevivência real é <b>{money(minimoRealCents)}</b>. Só
        negocie parcelas que caibam na sobra real ({margemRealCents > 0 ? money(margemRealCents) : 'R$ 0,00'}).
      </p>
    </div>
  );
}

/* ============================================================================
 * MÓDULO 4 — RESERVA DE EMERGÊNCIA
 * ========================================================================== */

/** m4-l1: Calculadora do custo básico */
function CalculadoraCustoBasico() {
  const ITENS = [
    { id: 'moradia', label: 'Aluguel / Moradia', valor: 90000, superfluo: false },
    { id: 'mercado', label: 'Mercado básico', valor: 60000, superfluo: false },
    { id: 'transporte', label: 'Transporte', valor: 25000, superfluo: false },
    { id: 'contas', label: 'Luz, água e internet', valor: 25000, superfluo: false },
    { id: 'delivery', label: 'Delivery & lanches', valor: 30000, superfluo: true },
    { id: 'roles', label: 'Rolês & streaming', valor: 25000, superfluo: true },
  ];

  const [ativos, setAtivos] = useState<Record<string, boolean>>({
    moradia: true,
    mercado: true,
    transporte: true,
    contas: true,
    delivery: true,
    roles: true,
  });

  const toggle = (id: string) => setAtivos((p) => ({ ...p, [id]: !p[id] }));

  const custoBasicoCents = ITENS.reduce((acc, it) => acc + (ativos[it.id] ? it.valor : 0), 0);

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-xs text-tinta-suave">
        Desmarque os supérfluos que você cortaria num mês de aperto para achar seu custo básico real:
      </p>

      <div className="flex flex-col gap-1.5">
        {ITENS.map((it) => {
          const marcado = Boolean(ativos[it.id]);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              className={`flex items-center justify-between rounded-xl border-[1.5px] px-3 py-2.5 text-left transition ${
                marcado ? 'border-linha bg-cartao' : 'border-menta bg-menta-clara/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                    marcado ? 'border-linha bg-papel-2 text-tinta' : 'border-menta bg-menta text-tinta'
                  }`}
                >
                  {marcado ? '✓' : '—'}
                </span>
                <span className={`text-xs font-semibold ${!marcado ? 'line-through text-tinta-suave' : 'text-tinta'}`}>
                  {it.label}
                </span>
              </div>
              <span className="font-display text-xs font-extrabold text-tinta">{money(it.valor)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-amarelo-claro p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">1 mês</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(custoBasicoCents)}</p>
        </div>
        <div className="rounded-xl bg-azul p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">3 meses</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(custoBasicoCents * 3)}</p>
        </div>
        <div className="rounded-xl bg-menta-clara p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">6 meses</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(custoBasicoCents * 6)}</p>
        </div>
      </div>
    </div>
  );
}

/** m4-l2: Comparador de liquidez e segurança */
function ComparadorLiquidezSeguranca() {
  const [urgencia, setUrgencia] = useState(1200);

  const urgenciaCents = urgencia * 100;
  // Investimento travado D+30 força 1 mês no rotativo (~15% com IOF) enquanto rende ~1% travado
  const custoRotativoCents = Math.round(urgenciaCents * 0.15);
  const rendimentoTravadoCents = Math.round(urgenciaCents * 0.01);
  const prejuizoTravadoCents = custoRotativoCents - rendimentoTravadoCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Urgência médica inesperada</span>
          <span className="font-display font-extrabold">{money(urgenciaCents)}</span>
        </span>
        <input
          type="range"
          min={300}
          max={5000}
          step={100}
          value={urgencia}
          onChange={(e) => setUrgencia(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-verde-texto">Reserva D+0</span>
          <p className="text-xs font-semibold text-tinta mt-1">CDB 100% CDI / Selic</p>
          <p className="font-display text-xl font-extrabold text-verde-texto mt-1">R$ 0,00</p>
          <span className="text-[11px] text-verde-texto">de juros pagos</span>
        </div>

        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-vermelho-texto">Travado D+30</span>
          <p className="text-xs font-semibold text-tinta mt-1">Cai no rotativo 30d</p>
          <p className="font-display text-xl font-extrabold text-vermelho-texto mt-1">−{money(prejuizoTravadoCents)}</p>
          <span className="text-[11px] text-vermelho-texto">prejuízo líquido</span>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        💧 <b>Liquidez vale mais que 0,1% de rentabilidade:</b> mesmo que o investimento travado renda{' '}
        {money(rendimentoTravadoCents)} no mês, o rotativo cobra <b>{money(custoRotativoCents)}</b> até o dinheiro
        destravar. Reserva de emergência precisa ser D+0.
      </p>
    </div>
  );
}

function ToggleSimNao({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-linha bg-cartao p-2.5">
      <span className="text-xs font-semibold text-tinta">{label}</span>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
            valor ? 'bg-laranja text-tinta' : 'bg-papel-2 text-tinta-suave'
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
            !valor ? 'bg-laranja text-tinta' : 'bg-papel-2 text-tinta-suave'
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
}

/** m4-l3: O teste do semáforo da emergência */
function SemaforoDaEmergencia() {
  const [inesperado, setInesperado] = useState<boolean>(true);
  const [urgente, setUrgente] = useState<boolean>(true);
  const [alternativa, setAlternativa] = useState<boolean>(false);

  const getResultado = () => {
    if (inesperado && urgente && !alternativa) {
      return {
        cor: 'bg-menta-clara text-verde-texto',
        titulo: '🟢 Sinal Verde — Emergência real',
        texto:
          'É inesperado, urgente e não há opção mais barata. É exatamente para isso que sua reserva existe: use sem culpa e planeje a reposição.',
      };
    }
    if (!inesperado && !urgente) {
      return {
        cor: 'bg-rosa text-vermelho-texto',
        titulo: '🔴 Sinal Vermelho — Desejo disfarçado',
        texto:
          'Não é inesperado nem urgente. Não toque na reserva! Se você quer isso, crie uma caixinha separada e junte antes.',
      };
    }
    return {
      cor: 'bg-amarelo-claro text-laranja-texto',
      titulo: '🟡 Sinal Amarelo — Adie 7 dias ou reduza',
      texto: alternativa
        ? 'Existe uma alternativa mais barata: resolva pelo menor custo possível antes de mexer no seu colchão.'
        : 'Espere 7 dias ou reajuste o orçamento do mês antes de sacar da reserva.',
    };
  };

  const res = getResultado();

  return (
    <div className="flex flex-col gap-3">
      <ToggleSimNao label="1. Foi algo inesperado?" valor={inesperado} onChange={setInesperado} />
      <ToggleSimNao label="2. É essencial / urgente hoje?" valor={urgente} onChange={setUrgente} />
      <ToggleSimNao label="3. Tem alternativa mais barata?" valor={alternativa} onChange={setAlternativa} />

      <div className={`rounded-2xl p-3.5 text-xs leading-relaxed ${res.cor}`}>
        <p className="font-display text-sm font-extrabold mb-1">{res.titulo}</p>
        <p>{res.texto}</p>
      </div>
    </div>
  );
}

/** m4-l4: Reconstrução do muro */
function ReconstrucaoDoMuro() {
  const [usou, setUsou] = useState(1200);
  const [porMes, setPorMes] = useState(200);

  const meses = Math.ceil(usou / porMes);
  const pctMes1 = Math.min(100, Math.round((porMes / usou) * 100));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Quanto usou da reserva</span>
          <span className="font-display font-extrabold">{money(usou * 100)}</span>
        </span>
        <input
          type="range"
          min={200}
          max={6000}
          step={100}
          value={usou}
          onChange={(e) => setUsou(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Aporte mensal p/ recompor</span>
          <span className="font-display font-extrabold">{money(porMes * 100)}/mês</span>
        </span>
        <input
          type="range"
          min={50}
          max={1500}
          step={50}
          value={porMes}
          onChange={(e) => setPorMes(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="rounded-2xl bg-menta-clara p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-verde-texto">Tempo para reconstruir</span>
        <span className="font-display text-2xl font-extrabold text-verde-texto">
          {meses} {meses === 1 ? 'mês' : 'meses'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs font-semibold text-tinta-suave">
          <span>Progresso já no 1º mês</span>
          <span>{pctMes1}% do muro de pé</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
          <div style={{ width: `${pctMes1}%` }} className="h-full bg-menta transition-all duration-200" />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        🧱 <b>Usar a reserva não é fracasso:</b> ela cumpriu o papel dela. Coloque a reposição de{' '}
        <b>{money(porMes * 100)}/mês</b> como conta fixa até fechar os <b>{meses} meses</b>.
      </p>
    </div>
  );
}

/** m4-l5: O termômetro da paz de espírito */
function TermometroPazDeEspirito() {
  const [guardado, setGuardado] = useState(3600);
  const [custoBasico, setCustoBasico] = useState(1800);

  const mesesAutonomia = guardado / custoBasico;
  const pctBarra = Math.min(100, Math.round((mesesAutonomia / 6) * 100));

  const nivel =
    mesesAutonomia < 1
      ? { cor: 'bg-rosa text-vermelho-texto', label: 'Dependência crítica do próximo salário' }
      : mesesAutonomia < 3
        ? { cor: 'bg-amarelo-claro text-laranja-texto', label: 'Colchão inicial (fôlego de curto prazo)' }
        : mesesAutonomia < 6
          ? { cor: 'bg-azul text-tinta', label: 'Zona de tranquilidade (boa autonomia)' }
          : { cor: 'bg-menta-clara text-verde-texto', label: 'Paz de espírito plena (6+ meses)' };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Saldo guardado hoje</span>
          <span className="font-display font-extrabold">{money(guardado * 100)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={25000}
          step={200}
          value={guardado}
          onChange={(e) => setGuardado(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Seu custo básico mensal</span>
          <span className="font-display font-extrabold">{money(custoBasico * 100)}</span>
        </span>
        <input
          type="range"
          min={800}
          max={6000}
          step={100}
          value={custoBasico}
          onChange={(e) => setCustoBasico(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="rounded-2xl bg-papel-2 border border-linha p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-tinta-suave">Autonomia (Runway)</span>
        <span className="font-display text-2xl font-extrabold text-tinta">
          {mesesAutonomia.toFixed(1).replace('.', ',')} meses
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="h-3.5 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
          <div style={{ width: `${pctBarra}%` }} className="h-full bg-menta transition-all duration-200" />
        </div>
        <p className={`rounded-xl p-3 text-xs font-semibold ${nivel.cor}`}>{nivel.label}</p>
      </div>
    </div>
  );
}

/* ============================================================================
 * MÓDULO 5 — AUMENTANDO A RENDA
 * ========================================================================== */

/** m5-l1: Aportes vs. Aumento de renda */
function AportesVsAumentoDeRenda() {
  const [aporteInicial, setAporteInicial] = useState(50);
  const [aportePosCarreira, setAportePosCarreira] = useState(800);
  const TAXA = 0.008; // 0,8% ao mês

  // Cenário A: aporta desde o mês 1 por 120 meses
  const calcularMontante = (aporteMensal: number, mesesAportando: number) => {
    let saldo = 0;
    for (let i = 0; i < mesesAportando; i++) {
      saldo = (saldo + aporteMensal * 100) * (1 + TAXA);
    }
    return Math.round(saldo);
  };

  const cenarioACents = calcularMontante(aporteInicial, 120);
  // Cenário B: 3 anos (36m) investindo na carreira (aporte R$ 0), depois 84 meses aportando
  const cenarioBCents = calcularMontante(aportePosCarreira, 84);
  const maxCents = Math.max(1, cenarioACents, cenarioBCents);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Cenário A: aporte desde o dia 1 (10 anos)</span>
          <span className="font-bold">{money(aporteInicial * 100)}/mês</span>
        </span>
        <input
          type="range"
          min={50}
          max={400}
          step={25}
          value={aporteInicial}
          onChange={(e) => setAporteInicial(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Cenário B: aporte após 3 anos de carreira (7 anos)</span>
          <span className="font-bold">{money(aportePosCarreira * 100)}/mês</span>
        </span>
        <input
          type="range"
          min={300}
          max={2000}
          step={50}
          value={aportePosCarreira}
          onChange={(e) => setAportePosCarreira(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <div className="rounded-xl bg-amarelo-claro p-3">
          <div className="flex justify-between text-xs font-semibold">
            <span>Só juros compostos ({money(aporteInicial * 100)}/mês)</span>
            <span className="font-display font-extrabold">{money(cenarioACents)}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-cartao">
            <div style={{ width: `${Math.round((cenarioACents / maxCents) * 100)}%` }} className="h-full bg-amarelo" />
          </div>
        </div>

        <div className="rounded-xl bg-menta-clara p-3">
          <div className="flex justify-between text-xs font-semibold text-verde-texto">
            <span>Carreira + aporte maior ({money(aportePosCarreira * 100)}/mês)</span>
            <span className="font-display font-extrabold">{money(cenarioBCents)}</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-cartao">
            <div style={{ width: `${Math.round((cenarioBCents / maxCents) * 100)}%` }} className="h-full bg-menta" />
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        🚀 <b>Renda é o motor do aporte (0,8%/mês em 10 anos):</b> aumentar sua capacidade de ganhar gera{' '}
        <b>
          {cenarioBCents >= cenarioACents
            ? `${money(cenarioBCents - cenarioACents)} a mais`
            : `${money(cenarioACents - cenarioBCents)} a menos`}
        </b>{' '}
        do que depender só de aportes minúsculos desde o primeiro dia.
      </p>
    </div>
  );
}

/** m5-l2: Calculadora do ROI educacional */
function CalculadoraRoiEducacional() {
  const [custo, setCusto] = useState(1500);
  const [aumento, setAumento] = useState(500);

  const custoCents = custo * 100;
  const aumentoCents = aumento * 100;
  const paybackMeses = custo / aumento;
  const retorno2AnosCents = aumentoCents * 24 - custoCents;
  const roiPct = ((aumento * 24 - custo) / custo) * 100;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Custo total do curso / formação</span>
          <span className="font-display font-extrabold">{money(custoCents)}</span>
        </span>
        <input
          type="range"
          min={200}
          max={10000}
          step={100}
          value={custo}
          onChange={(e) => setCusto(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Aumento mensal esperado na renda</span>
          <span className="font-display font-extrabold">+{money(aumentoCents)}/mês</span>
        </span>
        <input
          type="range"
          min={100}
          max={3000}
          step={50}
          value={aumento}
          onChange={(e) => setAumento(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">Payback (se paga em)</span>
          <p className="font-display text-2xl font-extrabold text-tinta">
            {paybackMeses.toFixed(1).replace('.', ',')} meses
          </p>
        </div>
        <div className={`rounded-2xl p-3 ${retorno2AnosCents >= 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Lucro líquido em 2 anos</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(retorno2AnosCents)}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        🎓 <b>ROI em 24 meses: {roiPct.toFixed(0)}%.</b>{' '}
        {paybackMeses <= 12
          ? 'Excelente retorno: em menos de 1 ano o curso já devolveu cada centavo investido.'
          : 'Retorno de médio prazo: valide se a vaga/mercado realmente paga esse aumento antes de fechar.'}
      </p>
    </div>
  );
}

/** m5-l3: O balanço do estágio */
function BalancoDoEstagio() {
  const [bolsa, setBolsa] = useState(1200);
  const [mensalidade, setMensalidade] = useState(450);
  const [transporte, setTransporte] = useState(220);
  const [alimentacao, setAlimentacao] = useState(280);

  const liquidoCents = (bolsa - mensalidade - transporte - alimentacao) * 100;
  const positivo = liquidoCents >= 0;

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Bolsa-auxílio mensal</span>
          <span className="font-bold text-verde-texto">+{money(bolsa * 100)}</span>
        </span>
        <input
          type="range"
          min={500}
          max={3000}
          step={50}
          value={bolsa}
          onChange={(e) => setBolsa(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Mensalidade do curso</span>
          <span className="font-bold text-vermelho-texto">−{money(mensalidade * 100)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={1500}
          step={50}
          value={mensalidade}
          onChange={(e) => setMensalidade(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Transporte</span>
          <span className="font-bold text-vermelho-texto">−{money(transporte * 100)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={500}
          step={20}
          value={transporte}
          onChange={(e) => setTransporte(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Alimentação fora</span>
          <span className="font-bold text-vermelho-texto">−{money(alimentacao * 100)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={800}
          step={20}
          value={alimentacao}
          onChange={(e) => setAlimentacao(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className={`rounded-2xl p-3 flex items-center justify-between ${positivo ? 'bg-menta-clara' : 'bg-rosa'}`}>
        <span className="text-xs font-semibold text-tinta">Saldo líquido real/mês</span>
        <span className="font-display text-2xl font-extrabold text-tinta">{money(liquidoCents)}</span>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        {positivo ? (
          <>
            ✅ <b>Saldo positivo:</b> além da experiência no currículo, sobram <b>{money(liquidoCents)}</b> limpos por
            mês ({money(liquidoCents * 12)}/ano).
          </>
        ) : (
          <>
            ⚠️ <b>Você está pagando para estagiar:</b> faltam {money(Math.abs(liquidoCents))}/mês. Só vale se houver
            chance real de efetivação rápida ou auxílio-transporte/refeição.
          </>
        )}
      </p>
    </div>
  );
}

/** m5-l4: Calculadora da hora de freela */
function CalculadoraHoraDeFreela() {
  const [horas, setHoras] = useState(12);
  const [valorHora, setValorHora] = useState(60);
  const [custosDiretos, setCustosDiretos] = useState(120);
  const [margemRevisao, setMargemRevisao] = useState(20);

  const maoDeObraCents = horas * valorHora * 100;
  const margemCents = Math.round((maoDeObraCents * margemRevisao) / 100);
  const custosCents = custosDiretos * 100;
  const precoMinimoCents = maoDeObraCents + margemCents + custosCents;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Horas estimadas</span>
            <span className="font-bold">{horas}h</span>
          </span>
          <input
            type="range"
            min={2}
            max={60}
            step={1}
            value={horas}
            onChange={(e) => setHoras(+e.target.value)}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Sua hora desejada</span>
            <span className="font-bold">{money(valorHora * 100)}</span>
          </span>
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={valorHora}
            onChange={(e) => setValorHora(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Custos (net/MEI/app)</span>
            <span className="font-bold">{money(custosCents)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={800}
            step={20}
            value={custosDiretos}
            onChange={(e) => setCustosDiretos(+e.target.value)}
            className="accent-laranja"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Margem de revisão</span>
            <span className="font-bold">+{margemRevisao}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={5}
            value={margemRevisao}
            onChange={(e) => setMargemRevisao(+e.target.value)}
            className="accent-laranja"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-menta-clara p-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-verde-texto">Preço mínimo a cobrar</span>
        <span className="font-display text-2xl font-extrabold text-verde-texto">{money(precoMinimoCents)}</span>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        🧮 <b>Sem pagar para trabalhar:</b> {money(maoDeObraCents)} de horas + {money(margemCents)} de margem de
        alteração + {money(custosCents)} de custos diretos.
      </p>
    </div>
  );
}

/** m5-l5: Alocação inteligente da renda extra */
function AlocacaoRendaExtra() {
  const [valorExtra, setValorExtra] = useState(600);
  const [pctPendencias, setPctPendencias] = useState(40);
  const [pctReserva, setPctReserva] = useState(40);
  const pctLazer = Math.max(0, 100 - pctPendencias - pctReserva);

  const totalCents = valorExtra * 100;
  const pendenciasCents = Math.round((totalCents * pctPendencias) / 100);
  const reservaCents = Math.round((totalCents * pctReserva) / 100);
  const lazerCents = totalCents - pendenciasCents - reservaCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Valor do bico / freela</span>
          <span className="font-display font-extrabold">{money(totalCents)}</span>
        </span>
        <input
          type="range"
          min={100}
          max={3000}
          step={50}
          value={valorExtra}
          onChange={(e) => setValorExtra(+e.target.value)}
          className="accent-laranja"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Pendências / Dívidas</span>
            <span className="font-bold text-laranja-texto">
              {pctPendencias}% ({money(pendenciasCents)})
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pctPendencias}
            onChange={(e) => {
              const v = +e.target.value;
              setPctPendencias(v);
              if (v + pctReserva > 100) setPctReserva(100 - v);
            }}
            className="accent-amarelo"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-xs font-semibold">
            <span>Reserva de emergência</span>
            <span className="font-bold text-verde-texto">
              {pctReserva}% ({money(reservaCents)})
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={pctReserva}
            onChange={(e) => {
              const v = +e.target.value;
              setPctReserva(v);
              if (v + pctPendencias > 100) setPctPendencias(100 - v);
            }}
            className="accent-menta"
          />
        </label>
      </div>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-papel-2 border border-linha">
        <div style={{ width: `${pctPendencias}%` }} className="bg-amarelo transition-all" />
        <div style={{ width: `${pctReserva}%` }} className="bg-menta transition-all" />
        <div style={{ width: `${pctLazer}%` }} className="bg-rosa transition-all" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-amarelo-claro p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Pendências</span>
          <p className="font-display text-sm font-extrabold">{money(pendenciasCents)}</p>
        </div>
        <div className="rounded-xl bg-menta-clara p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Reserva</span>
          <p className="font-display text-sm font-extrabold">{money(reservaCents)}</p>
        </div>
        <div className="rounded-xl bg-rosa p-2.5 text-center">
          <span className="text-[11px] font-semibold text-tinta-suave block">Lazer ({pctLazer}%)</span>
          <p className="font-display text-sm font-extrabold">{money(lazerCents)}</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-tinta-suave">
        ✨ <b>Regra do esforço recompensado:</b> separe uma fatia planejada para o lazer ({money(lazerCents)}) sem culpa
        — assim você mantém o gás para os próximos extras sem torrar tudo.
      </p>
    </div>
  );
}
