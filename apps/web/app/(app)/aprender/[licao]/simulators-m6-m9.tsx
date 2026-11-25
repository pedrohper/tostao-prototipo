'use client';
import { useState } from 'react';
import { money } from '@/lib/format';
import { Selo } from '@/components/selo';
import { TostaoSlider } from '@/components/tostao-slider';

export const SIMULATORS_M6_M9: Record<string, () => React.ReactNode> = {
  'm6-l1': CalculadoraHoleriteReal,
  'm6-l2': SaqueAniversarioVsRescisao,
  'm6-l3': FatiadorDecimoTerceiro,
  'm6-l4': ContaRetornoFerias,
  'm6-l5': EquivalenciaCltPj,
  'm7-l1': CalculadoraCDI,
  'm7-l2': RaioXGarantiaFGC,
  'm7-l3': MordidaLeaoResgate,
  'm7-l4': MapaDoTesouro,
  'm7-l5': CalculadoraGanhoReal,
  'm8-l1': SocioVsApostador,
  'm8-l2': RendaPassivaFIIs,
  'm8-l3': ApostaIndividualVsIndice,
  'm8-l4': DetectorCharlatanismo,
  'm8-l5': TesteCardiacoVolatilidade,
  'm9-l1': TesteFalsaCentral,
  'm9-l2': VantagemDaBanca,
  'm9-l3': QuebraGeometricaPiramide,
  'm9-l4': EscrutinioDaVaga,
  'm9-l5': ContaAbsurdoEconomico,
};

// ---------------------------------------------------------------------------
// Helpers compartilhados (INSS / IRRF simplificados)
// ---------------------------------------------------------------------------

function calcInssCents(brutoCents: number): number {
  const bruto = brutoCents / 100;
  const faixas: [number, number][] = [
    [1518.0, 0.075],
    [2793.88, 0.09],
    [4190.83, 0.12],
    [8157.41, 0.14],
  ];
  let anterior = 0;
  let total = 0;
  for (const [teto, aliq] of faixas) {
    if (bruto <= anterior) break;
    const base = Math.min(bruto, teto) - anterior;
    total += base * aliq;
    anterior = teto;
  }
  return Math.round(total * 100);
}

function calcIrrfCents(brutoCents: number, inssCents: number): number {
  const bruto = brutoCents / 100;
  const inss = inssCents / 100;
  // Desconto simplificado mensal (R$ 564,80) vs INSS legal: usa o maior
  const deducao = Math.max(inss, 564.8);
  const base = Math.max(0, bruto - deducao);
  let ir: number;
  if (base <= 2259.2) ir = 0;
  else if (base <= 2826.65) ir = base * 0.075 - 169.44;
  else if (base <= 3751.05) ir = base * 0.15 - 381.44;
  else if (base <= 4664.68) ir = base * 0.225 - 662.77;
  else ir = base * 0.275 - 896.0;
  return Math.max(0, Math.round(ir * 100));
}

function formatCompactMoney(reais: number): string {
  if (!Number.isFinite(reais) || reais >= 1e15) return 'R$ ∞ (astronômico)';
  if (reais >= 1e12) return `R$ ${(reais / 1e12).toFixed(2).replace('.', ',')} trilhões`;
  if (reais >= 1e9) return `R$ ${(reais / 1e9).toFixed(2).replace('.', ',')} bilhões`;
  if (reais >= 1e6) return `R$ ${(reais / 1e6).toFixed(2).replace('.', ',')} milhões`;
  return money(Math.round(reais * 100));
}

// ===========================================================================
// MÓDULO 6: CLT, Direitos e Carreira
// ===========================================================================

/** m6-l1: Calculadora do Holerite Real */
function CalculadoraHoleriteReal() {
  const [bruto, setBruto] = useState(3500);
  const brutoCents = bruto * 100;
  const inssCents = calcInssCents(brutoCents);
  const irrfCents = calcIrrfCents(brutoCents, inssCents);
  const liquidoCents = brutoCents - inssCents - irrfCents;
  const pctDesconto = (((inssCents + irrfCents) / brutoCents) * 100).toFixed(1).replace('.', ',');

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Salário bruto CLT</span>
          <span className="font-display text-base font-extrabold">{money(brutoCents)}</span>
        </span>
        <TostaoSlider min={1500} max={15000} step={100} value={bruto} onChange={(e) => setBruto(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-xs font-semibold text-tinta-suave">INSS progressivo</span>
          <p className="font-display text-xl font-extrabold text-vermelho-texto">−{money(inssCents)}</p>
        </div>
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-xs font-semibold text-tinta-suave">IRRF na fonte</span>
          <p className="font-display text-xl font-extrabold text-vermelho-texto">−{money(irrfCents)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-menta-clara p-3.5">
        <span className="text-xs font-semibold text-verde-texto">Líquido real que cai na conta</span>
        <div className="flex items-baseline justify-between">
          <p className="font-display text-2xl font-extrabold text-tinta">{money(liquidoCents)}</p>
          <span className="text-xs font-bold text-verde-texto">−{pctDesconto}% de descontos</span>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        <Selo tipo="dica" />O INSS é cobrado por faixas (como uma escada), não sobre o total. E o IRRF usa o desconto
        simplificado automático quando ele é mais vantajoso que a dedução do INSS.
      </p>
    </div>
  );
}

/** m6-l2: Simulador de Saque-Aniversário vs. Rescisão */
function SaqueAniversarioVsRescisao() {
  const [bruto, setBruto] = useState(3000);
  const [anos, setAnos] = useState(3);

  const depositoMensalCents = Math.round(bruto * 100 * 0.08);
  const saldoFgtsCents = depositoMensalCents * 12 * anos;
  const multa40Cents = Math.round(saldoFgtsCents * 0.4);
  const saqueRescisaoCents = saldoFgtsCents + multa40Cents;
  const saqueAniversarioCents = multa40Cents;
  const travadoCents = saldoFgtsCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Salário bruto</span>
          <span className="font-display text-base font-extrabold">{money(bruto * 100)}</span>
        </span>
        <TostaoSlider min={1500} max={12000} step={100} value={bruto} onChange={(e) => setBruto(+e.target.value)} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-tinta">
          Tempo de empresa: {anos} ano{anos > 1 ? 's' : ''}
        </span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnos(a)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                anos === a ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
              }`}
            >
              {a}a
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-papel-2 p-3 text-[13px] leading-[18px] text-tinta-suave">
        Saldo acumulado de FGTS (8%/mês): <b className="text-tinta">{money(saldoFgtsCents)}</b> + Multa de 40%:{' '}
        <b className="text-tinta">{money(multa40Cents)}</b>.
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">Saque-Rescisão</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(saqueRescisaoCents)}</p>
          <span className="text-[12px] text-verde-texto">Saldo + multa de 40%</span>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-vermelho-texto">Saque-Aniversário</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(saqueAniversarioCents)}</p>
          <span className="text-[12px] text-vermelho-texto">Só a multa na demissão</span>
        </div>
      </div>

      <p className="rounded-xl bg-amarelo-claro p-3 text-[13px] leading-relaxed text-laranja-texto">
        <Selo tipo="alerta" />
        No Saque-Aniversário, <b>{money(travadoCents)}</b> do seu saldo ficam retidos se você for demitido sem justa
        causa — e voltar para o Saque-Rescisão leva 25 meses.
      </p>
    </div>
  );
}

/** m6-l3: Fatiador do 13º */
function FatiadorDecimoTerceiro() {
  const [liquido, setLiquido] = useState(2800);
  const [dividas, setDividas] = useState(50);
  const [janeiro, setJaneiro] = useState(30);
  const festas = Math.max(0, 100 - dividas - janeiro);

  const totalCents = liquido * 100;
  const parc1Cents = Math.round(totalCents * 0.54);
  const parc2Cents = totalCents - parc1Cents;

  const divCents = Math.round((totalCents * dividas) / 100);
  const janCents = Math.round((totalCents * janeiro) / 100);
  const fesCents = totalCents - divCents - janCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>13º líquido total</span>
          <span className="font-display text-base font-extrabold">{money(totalCents)}</span>
        </span>
        <TostaoSlider min={1000} max={10000} step={100} value={liquido} onChange={(e) => setLiquido(+e.target.value)} />
        <span className="text-[13px] text-tinta-suave">
          1ª parcela (nov): ~{money(parc1Cents)} · 2ª parcela (dez, com descontos): ~{money(parc2Cents)}
        </span>
      </label>

      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
            <span>Quitar dívidas / cartão</span>
            <span className="font-bold text-verde-texto">
              {dividas}% ({money(divCents)})
            </span>
          </span>
          <TostaoSlider
            min={0}
            max={100}
            step={5}
            value={dividas}
            onChange={(e) => {
              const v = +e.target.value;
              setDividas(v);
              if (v + janeiro > 100) setJaneiro(100 - v);
            }}
            tone="menta"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
            <span>Janeiro (IPVA, matrícula, material)</span>
            <span className="font-bold text-laranja-texto">
              {janeiro}% ({money(janCents)})
            </span>
          </span>
          <TostaoSlider
            min={0}
            max={100}
            step={5}
            value={janeiro}
            onChange={(e) => {
              const v = +e.target.value;
              setJaneiro(v);
              if (v + dividas > 100) setDividas(100 - v);
            }}
            tone="amarelo"
          />
        </label>
      </div>

      <div className="flex h-4 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
        <div style={{ width: `${dividas}%` }} className="bg-menta transition-all" />
        <div style={{ width: `${janeiro}%` }} className="bg-amarelo transition-all" />
        <div style={{ width: `${festas}%` }} className="bg-rosa transition-all" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-menta-clara p-2.5">
          <span className="text-[12px] font-semibold text-verde-texto">Dívidas</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(divCents)}</p>
        </div>
        <div className="rounded-xl bg-amarelo-claro p-2.5">
          <span className="text-[12px] font-semibold text-laranja-texto">Janeiro</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(janCents)}</p>
        </div>
        <div className="rounded-xl bg-rosa p-2.5">
          <span className="text-[12px] font-semibold text-vermelho-texto">Festas ({festas}%)</span>
          <p className="font-display text-sm font-extrabold text-tinta">{money(fesCents)}</p>
        </div>
      </div>
    </div>
  );
}

/** m6-l4: A conta do retorno das férias */
function ContaRetornoFerias() {
  const [salario, setSalario] = useState(3000);
  const [gastouTudo, setGastouTudo] = useState(true);

  const salCents = salario * 100;
  const tercoCents = Math.round(salCents / 3);
  const entraNaSaidaCents = salCents + tercoCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Salário mensal líquido</span>
          <span className="font-display text-base font-extrabold">{money(salCents)}</span>
        </span>
        <TostaoSlider min={1500} max={10000} step={100} value={salario} onChange={(e) => setSalario(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-azul p-3">
          <span className="text-xs font-semibold text-tinta-suave">Adiantamento + 1/3</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(entraNaSaidaCents)}</p>
          <span className="text-[13px] text-tinta-suave">Extra real é só {money(tercoCents)}</span>
        </div>
        <div className={`rounded-2xl p-3 ${gastouTudo ? 'bg-rosa' : 'bg-menta-clara'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Saldo no mês de volta</span>
          <p className="font-display text-xl font-extrabold text-tinta">{gastouTudo ? money(0) : money(salCents)}</p>
          <span className="text-[12px] text-tinta-suave">
            {gastouTudo ? 'Buraco no orçamento!' : 'Contas do mês cobertas'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setGastouTudo(true)}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
            gastouTudo ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          Gastar tudo nas férias
        </button>
        <button
          type="button"
          onClick={() => setGastouTudo(false)}
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
            !gastouTudo ? 'bg-menta text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          Guardar o adiantamento
        </button>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo={gastouTudo ? 'perigo' : 'ok'} />
        {gastouTudo
          ? `Se você gastar os ${money(entraNaSaidaCents)} viajando, na volta das férias o próximo salário já foi adiantado — sobra ${money(0)} para pagar aluguel e mercado.`
          : `Separando ${money(salCents)} para o mês seguinte, você curte as férias com o 1/3 extra (${money(tercoCents)}) sem cair no rotativo na volta.`}
      </p>
    </div>
  );
}

/** m6-l5: Equivalência CLT x PJ */
function EquivalenciaCltPj() {
  const [cltBruto, setCltBruto] = useState(5000);
  const [beneficios, setBeneficios] = useState(800);
  const [pjMensal, setPjMensal] = useState(7500);

  const cltBrutoCents = cltBruto * 100;
  const inss = calcInssCents(cltBrutoCents);
  const irrf = calcIrrfCents(cltBrutoCents, inss);
  const cltLiqMensal = cltBrutoCents - inss - irrf;

  // CLT anual: 12 salários + 13º + 1/3 férias + FGTS (13,33 * 8%) + benefícios * 12
  const fgtsAnual = Math.round(cltBrutoCents * 0.08 * 13.33);
  const cltAnualCents =
    cltLiqMensal * 12 +
    cltLiqMensal + // 13º líquido aprox
    Math.round(cltLiqMensal / 3) + // 1/3 férias aprox
    fgtsAnual +
    beneficios * 100 * 12;

  // PJ anual: 11 meses faturados (1 mês de descanso) - 6% DAS - R$ 200/mês contador
  const pjBrutoAnual = pjMensal * 100 * 11;
  const pjDas = Math.round(pjBrutoAnual * 0.06);
  const pjContador = 200 * 100 * 12;
  const pjAnualCents = Math.max(0, pjBrutoAnual - pjDas - pjContador);

  const diffAnual = pjAnualCents - cltAnualCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Salário bruto CLT</span>
          <span className="font-bold">{money(cltBrutoCents)}</span>
        </span>
        <TostaoSlider
          min={2000}
          max={15000}
          step={250}
          value={cltBruto}
          onChange={(e) => setCltBruto(+e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Benefícios CLT (VR/VA/Saúde por mês)</span>
          <span className="font-bold">{money(beneficios * 100)}</span>
        </span>
        <TostaoSlider
          min={0}
          max={2500}
          step={100}
          value={beneficios}
          onChange={(e) => setBeneficios(+e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Proposta PJ mensal</span>
          <span className="font-bold">{money(pjMensal * 100)}</span>
        </span>
        <TostaoSlider
          min={2000}
          max={25000}
          step={250}
          value={pjMensal}
          onChange={(e) => setPjMensal(+e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-azul p-3">
          <span className="text-xs font-semibold text-tinta-suave">CLT líquido/ano*</span>
          <p className="font-display text-lg font-extrabold text-tinta">{money(cltAnualCents)}</p>
          <span className="text-[13px] text-tinta-suave">~{money(Math.round(cltAnualCents / 12))}/mês</span>
        </div>
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-tinta-suave">PJ líquido/ano**</span>
          <p className="font-display text-lg font-extrabold text-tinta">{money(pjAnualCents)}</p>
          <span className="text-[13px] text-tinta-suave">~{money(Math.round(pjAnualCents / 12))}/mês</span>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo="dados" />
        {diffAnual >= 0
          ? `O PJ paga ${money(diffAnual)} a mais por ano (considerando 11 meses trabalhados, 6% de DAS e R$ 200/mês de contador).`
          : `A CLT vence por ${money(Math.abs(diffAnual))}/ano quando somamos 13º, 1/3 de férias, FGTS e benefícios.`}
      </p>
    </div>
  );
}

// ===========================================================================
// MÓDULO 7: Renda Fixa & Tesouro
// ===========================================================================

/** m7-l1: Calculadora do CDI */
function CalculadoraCDI() {
  const [valor, setValor] = useState(1000);
  const [meses, setMeses] = useState(12);

  const dias = meses * 30;
  const irAliquota = dias <= 180 ? 0.225 : dias <= 360 ? 0.2 : dias <= 720 ? 0.175 : 0.15;

  const taxaCdiAnual = 0.1115;
  const taxaPoupancaAnual = 0.0717; // 6,17% + TR ~1%

  const brutoCdb = valor * Math.pow(1 + taxaCdiAnual, meses / 12);
  const lucroBrutoCdb = brutoCdb - valor;
  const liqCdbCents = Math.round((valor + lucroBrutoCdb * (1 - irAliquota)) * 100);

  const liqPoupCents = Math.round(valor * Math.pow(1 + taxaPoupancaAnual, meses / 12) * 100);
  const diferencaCents = liqCdbCents - liqPoupCents;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Valor aplicado</span>
          <span className="font-display text-base font-extrabold">{money(valor * 100)}</span>
        </span>
        <TostaoSlider min={500} max={20000} step={500} value={valor} onChange={(e) => setValor(+e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Prazo</span>
          <span className="font-bold">
            {meses} meses (IR {(irAliquota * 100).toFixed(1).replace('.', ',')}%)
          </span>
        </span>
        <TostaoSlider min={3} max={60} step={3} value={meses} onChange={(e) => setMeses(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">CDB 100% CDI (líquido)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(liqCdbCents)}</p>
          <span className="text-[12px] text-verde-texto">~11,15% a.a. − IR</span>
        </div>
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-xs font-semibold text-tinta-suave">Poupança (isenta)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(liqPoupCents)}</p>
          <span className="text-[12px] text-tinta-suave">~6,17% + TR</span>
        </div>
      </div>

      <p className="rounded-xl bg-amarelo-claro p-3 text-[13px] leading-relaxed text-laranja-texto">
        <Selo tipo="alta" />
        Mesmo pagando Imposto de Renda, o CDB 100% CDI coloca <b>{money(diferencaCents)}</b> a mais no seu bolso nesse
        prazo.
      </p>
    </div>
  );
}

/** m7-l2: Raio-x da garantia FGC */
function RaioXGarantiaFGC() {
  const [b1, setB1] = useState(180000);
  const [b2, setB2] = useState(280000);
  const [b3, setB3] = useState(150000);

  const LIMITE_BANCO = 250000;
  const TETO_GLOBAL = 1000000;

  const bancos = [
    { nome: 'Banco A', valor: b1, set: setB1 },
    { nome: 'Banco B', valor: b2, set: setB2 },
    { nome: 'Banco C', valor: b3, set: setB3 },
  ];

  const total = b1 + b2 + b3;
  const cobertoPorBanco = bancos.reduce((acc, b) => acc + Math.min(b.valor, LIMITE_BANCO), 0);
  const cobertoTotal = Math.min(cobertoPorBanco, TETO_GLOBAL);
  const descoberto = total - cobertoTotal;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {bancos.map((b) => {
          const passou = b.valor > LIMITE_BANCO;
          return (
            <label key={b.nome} className="flex flex-col gap-1">
              <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
                <span>{b.nome}</span>
                <span className={`font-bold ${passou ? 'text-vermelho-texto' : 'text-tinta'}`}>
                  {money(b.valor * 100)} {passou ? '(acima de R$ 250 mil!)' : ''}
                </span>
              </span>
              <TostaoSlider
                min={0}
                max={500000}
                step={10000}
                value={b.valor}
                onChange={(e) => b.set(+e.target.value)}
              />
            </label>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">Protegido pelo FGC</span>
          <p className="font-display text-lg font-extrabold text-tinta">{money(cobertoTotal * 100)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${descoberto > 0 ? 'bg-rosa' : 'bg-papel-2'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Sem garantia (risco)</span>
          <p className="font-display text-lg font-extrabold text-tinta">{money(descoberto * 100)}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo={total > TETO_GLOBAL || descoberto > 0 ? 'alerta' : 'ok'} />
        {total > TETO_GLOBAL
          ? 'Atenção: você ultrapassou o teto global de R$ 1 milhão por CPF a cada 4 anos!'
          : descoberto > 0
            ? `Você tem ${money(descoberto * 100)} acima do limite de R$ 250 mil por instituição. Dividir entre bancos diferentes resolve!`
            : 'Tudo coberto! Nenhum banco passa de R$ 250 mil e o total está dentro do teto de R$ 1 milhão.'}
      </p>
    </div>
  );
}

/** m7-l3: A mordida do Leão no resgate */
function MordidaLeaoResgate() {
  const [valor, setValor] = useState(1000);
  const taxaAnual = 0.1115;

  const cenarios = [
    { label: 'Dia 15', dias: 15, iof: 0.5, ir: 0.225, cor: 'bg-rosa' },
    { label: 'Dia 181', dias: 181, iof: 0, ir: 0.2, cor: 'bg-amarelo-claro' },
    { label: 'Dia 721', dias: 721, iof: 0, ir: 0.15, cor: 'bg-menta-clara' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Aplicação inicial (CDB 100% CDI)</span>
          <span className="font-display text-base font-extrabold">{money(valor * 100)}</span>
        </span>
        <TostaoSlider min={1000} max={20000} step={500} value={valor} onChange={(e) => setValor(+e.target.value)} />
      </label>

      <div className="flex flex-col gap-2">
        {cenarios.map((c) => {
          const bruto = valor * Math.pow(1 + taxaAnual, c.dias / 365);
          const lucroBruto = bruto - valor;
          const descIof = lucroBruto * c.iof;
          const descIr = (lucroBruto - descIof) * c.ir;
          const impostoTotalCents = Math.round((descIof + descIr) * 100);
          const lucroLiqCents = Math.round((lucroBruto - descIof - descIr) * 100);
          return (
            <div key={c.label} className={`flex items-center justify-between rounded-2xl p-3 ${c.cor}`}>
              <div>
                <p className="text-xs font-extrabold text-tinta">{c.label}</p>
                <p className="text-[12px] text-tinta-suave">
                  IOF {(c.iof * 100).toFixed(0)}% · IR {(c.ir * 100).toFixed(1).replace('.', ',')}%
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-base font-extrabold text-tinta">+{money(lucroLiqCents)}</p>
                <p className="text-[13px] text-vermelho-texto">Leão levou {money(impostoTotalCents)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** m7-l4: O mapa do Tesouro */
function MapaDoTesouro() {
  const [objetivo, setObjetivo] = useState<'curto' | 'medio' | 'longo'>('curto');

  const MAPA = {
    curto: {
      titulo: 'Tesouro Selic',
      subtitulo: '1 ano / Reserva de emergência',
      taxa: 'Selic (~11,25% a.a.)',
      anos: 1,
      retornoEstimado: 0.1125,
      cor: 'bg-menta-clara',
      motivo:
        'Rende todo dia útil e não sofre perda se você precisar sacar antes. É o único título indicado para reserva de emergência.',
    },
    medio: {
      titulo: 'Tesouro Prefixado',
      subtitulo: '3 anos / Meta com data marcada',
      taxa: 'Taxa travada (~12,0% a.a.)',
      anos: 3,
      retornoEstimado: 0.12,
      cor: 'bg-amarelo-claro',
      motivo:
        'Você sabe exatamente quanto vai receber no vencimento. Mas cuidado: se vender antes do prazo, o preço oscila (marcação a mercado).',
    },
    longo: {
      titulo: 'Tesouro IPCA+',
      subtitulo: '10 anos / Aposentadoria e longo prazo',
      taxa: 'Inflação + ~6,2% a.a.',
      anos: 10,
      retornoEstimado: 0.107,
      cor: 'bg-azul',
      motivo: 'Garante que seu dinheiro sempre ganhe da inflação, protegendo seu poder de compra por décadas.',
    },
  }[objetivo];

  const projecaoCents = Math.round(1000 * Math.pow(1 + MAPA.retornoEstimado, MAPA.anos) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setObjetivo('curto')}
          className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
            objetivo === 'curto' ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          1 ano (Reserva)
        </button>
        <button
          type="button"
          onClick={() => setObjetivo('medio')}
          className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
            objetivo === 'medio' ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          3 anos (Meta)
        </button>
        <button
          type="button"
          onClick={() => setObjetivo('longo')}
          className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
            objetivo === 'longo' ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          10 anos (Futuro)
        </button>
      </div>

      <div className={`rounded-2xl p-4 ${MAPA.cor}`}>
        <span className="text-[12px] font-bold uppercase tracking-wide text-tinta-suave">{MAPA.subtitulo}</span>
        <h4 className="font-display text-xl font-extrabold text-tinta">{MAPA.titulo}</h4>
        <p className="mt-1 text-xs font-semibold text-tinta">{MAPA.taxa}</p>
        <p className="mt-2 text-xs leading-relaxed text-tinta-suave">{MAPA.motivo}</p>
      </div>

      <div className="rounded-xl bg-papel-2 p-3 text-[13px] leading-[18px] text-tinta-suave">
        Projeção bruta de <b>R$ 1.000,00</b> em {MAPA.anos} ano{MAPA.anos > 1 ? 's' : ''}:{' '}
        <b className="text-tinta">{money(projecaoCents)}</b>.
      </div>
    </div>
  );
}

/** m7-l5: Calculadora do Ganho Real */
function CalculadoraGanhoReal() {
  const [nominal, setNominal] = useState(11.5);
  const [ipca, setIpca] = useState(4.5);

  const real = ((1 + nominal / 100) / (1 + ipca / 100) - 1) * 100;
  const baseCents = 10000 * 100;
  const poderCompra1AnoCents = Math.round(baseCents * (1 + real / 100));
  const poderCompra5AnosCents = Math.round(baseCents * Math.pow(1 + real / 100, 5));

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Rentabilidade nominal (% a.a.)</span>
          <span className="font-bold">{nominal.toFixed(1).replace('.', ',')}%</span>
        </span>
        <TostaoSlider min={4} max={20} step={0.5} value={nominal} onChange={(e) => setNominal(+e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Inflação IPCA (% a.a.)</span>
          <span className="font-bold text-vermelho-texto">{ipca.toFixed(1).replace('.', ',')}%</span>
        </span>
        <TostaoSlider
          min={2}
          max={15}
          step={0.5}
          value={ipca}
          onChange={(e) => setIpca(+e.target.value)}
          tone="alerta"
        />
      </label>

      <div className={`rounded-2xl p-3.5 ${real >= 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
        <span className="text-xs font-semibold text-tinta-suave">Ganho real (Fórmula de Fisher)</span>
        <p className="font-display text-2xl font-extrabold text-tinta">
          {real >= 0 ? '+' : ''}
          {real.toFixed(2).replace('.', ',')}% ao ano
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-[13px] leading-[18px] font-semibold text-tinta-suave">R$ 10 mil em 1 ano</span>
          <p className="font-display text-base font-extrabold text-tinta">{money(poderCompra1AnoCents)}</p>
          <span className="text-[12px] text-tinta-suave">em poder de compra</span>
        </div>
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-[13px] leading-[18px] font-semibold text-tinta-suave">R$ 10 mil em 5 anos</span>
          <p className="font-display text-base font-extrabold text-tinta">{money(poderCompra5AnosCents)}</p>
          <span className="text-[12px] text-tinta-suave">em poder de compra</span>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// MÓDULO 8: Renda Variável & Bolhas
// ===========================================================================

/** m8-l1: Sócio vs. Apostador */
function SocioVsApostador() {
  const [modo, setModo] = useState<'dia' | 'anos'>('dia');

  const DIAS = [
    { label: 'Seg', varPct: -4.1, valorCents: 95900 },
    { label: 'Ter', varPct: +2.8, valorCents: 98585 },
    { label: 'Qua', varPct: -3.5, valorCents: 95134 },
    { label: 'Qui', varPct: +1.4, valorCents: 96466 },
    { label: 'Sex', varPct: -2.2, valorCents: 94344 },
  ];

  const ANOS = [
    { label: 'Ano 1', varPct: +12, valorCents: 112000 },
    { label: 'Ano 2', varPct: +14, valorCents: 127680 },
    { label: 'Ano 3', varPct: +11, valorCents: 141725 },
    { label: 'Ano 4', varPct: +15, valorCents: 162984 },
    { label: 'Ano 5', varPct: +13, valorCents: 184171 },
  ];

  const lista = modo === 'dia' ? DIAS : ANOS;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModo('dia')}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            modo === 'dia' ? 'bg-rosa text-vermelho-texto shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          Olhar todo dia
        </button>
        <button
          type="button"
          onClick={() => setModo('anos')}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            modo === 'anos'
              ? 'bg-menta-clara text-verde-texto shadow-sm'
              : 'border border-linha bg-cartao text-tinta-suave'
          }`}
        >
          Olhar em 5 anos
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {lista.map((item) => {
          const positivo = item.varPct >= 0;
          return (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-linha bg-cartao px-3 py-2 text-[13px] leading-[18px]"
            >
              <span className="font-bold text-tinta">{item.label}</span>
              <span className={`font-bold ${positivo ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
                {positivo ? '+' : ''}
                {item.varPct.toFixed(1).replace('.', ',')}%
              </span>
              <span className="font-display font-extrabold text-tinta">{money(item.valorCents)}</span>
            </div>
          );
        })}
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        {modo === 'dia'
          ? 'No curto prazo, o preço oscila por humor e notícia. Quem olha todo dia tende a vender na baixa por pânico.'
          : 'No longo prazo, o preço segue o lucro real da empresa. Quem pensa como sócio atravessa o ruído.'}
      </p>
    </div>
  );
}

/** m8-l2: Simulador de Renda Passiva em FIIs */
function RendaPassivaFIIs() {
  const [meta, setMeta] = useState(100);
  const [dy, setDy] = useState(0.85);

  const precoCota = 100; // R$ 100
  const dividendoPorCota = precoCota * (dy / 100);
  const cotasNecessarias = Math.ceil(meta / dividendoPorCota);
  const capitalCents = cotasNecessarias * precoCota * 100;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Meta de renda mensal isenta</span>
          <span className="font-display text-base font-extrabold">{money(meta * 100)}/mês</span>
        </span>
        <TostaoSlider min={50} max={3000} step={50} value={meta} onChange={(e) => setMeta(+e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Dividend Yield mensal estimado (cota R$ 100)</span>
          <span className="font-bold">{dy.toFixed(2).replace('.', ',')}%/mês</span>
        </span>
        <TostaoSlider min={0.6} max={1.1} step={0.05} value={dy} onChange={(e) => setDy(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-laranja-texto">Cotas necessárias</span>
          <p className="font-display text-2xl font-extrabold text-tinta">{cotasNecessarias}</p>
          <span className="text-[13px] text-laranja-texto">{money(Math.round(dividendoPorCota * 100))}/cota</span>
        </div>
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">Capital acumulado</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(capitalCents)}</p>
          <span className="text-[12px] text-verde-texto">para gerar a meta</span>
        </div>
      </div>
    </div>
  );
}

/** m8-l3: Aposta individual vs. Índice */
function ApostaIndividualVsIndice() {
  const [valor, setValor] = useState(5000);

  const valorCents = valor * 100;
  const acaoUnicaCents = Math.round(valorCents * 0.6); // -40%
  const etfIndiceCents = Math.round(valorCents * Math.pow(1.1, 5)); // +10% a.a. por 5 anos (~+61%)

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-sm font-semibold">
          <span>Capital investido</span>
          <span className="font-display text-base font-extrabold">{money(valorCents)}</span>
        </span>
        <TostaoSlider min={1000} max={20000} step={500} value={valor} onChange={(e) => setValor(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-vermelho-texto">1 Ação (queda de −40%)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(acaoUnicaCents)}</p>
          <span className="text-[12px] text-vermelho-texto">Risco concentrado</span>
        </div>
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">ETF Índice (5 anos)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(etfIndiceCents)}</p>
          <span className="text-[12px] text-verde-texto">Média ~10% a.a. (+61%)</span>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo="meta" />
        Diferença de <b>{money(etfIndiceCents - acaoUnicaCents)}</b>: uma empresa isolada pode quebrar ou perder
        mercado; um índice amplo dilui o risco entre dezenas de companhias.
      </p>
    </div>
  );
}

/** m8-l4: O detector de charlatanismo */
function DetectorCharlatanismo() {
  const [taxaMes, setTaxaMes] = useState(5);
  const [aporte, setAporte] = useState(1000);

  const r = taxaMes / 100;
  const em5Anos = aporte * Math.pow(1 + r, 60);
  const em10Anos = aporte * Math.pow(1 + r, 120);
  const em20Anos = aporte * Math.pow(1 + r, 240);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Rentabilidade mensal prometida</span>
          <span className="font-bold text-vermelho-texto">{taxaMes.toFixed(1).replace('.', ',')}% ao mês</span>
        </span>
        <TostaoSlider
          min={2}
          max={15}
          step={0.5}
          value={taxaMes}
          onChange={(e) => setTaxaMes(+e.target.value)}
          tone="alerta"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Aporte inicial único</span>
          <span className="font-bold">{money(aporte * 100)}</span>
        </span>
        <TostaoSlider min={500} max={10000} step={500} value={aporte} onChange={(e) => setAporte(+e.target.value)} />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between rounded-xl bg-amarelo-claro px-3 py-2 text-[13px] leading-[18px]">
          <span className="font-semibold text-laranja-texto">Em 5 anos (60 meses)</span>
          <span className="font-display font-extrabold text-tinta">{formatCompactMoney(em5Anos)}</span>
        </div>
        <div className="flex justify-between rounded-xl bg-rosa px-3 py-2 text-[13px] leading-[18px]">
          <span className="font-semibold text-vermelho-texto">Em 10 anos (120 meses)</span>
          <span className="font-display font-extrabold text-tinta">{formatCompactMoney(em10Anos)}</span>
        </div>
        <div className="flex justify-between rounded-xl bg-rosa px-3 py-2 text-[13px] leading-[18px]">
          <span className="font-semibold text-vermelho-texto">Em 20 anos (240 meses)</span>
          <span className="font-display font-extrabold text-tinta">{formatCompactMoney(em20Anos)}</span>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo="perigo" />O PIB inteiro do Brasil é ~R$ 11 trilhões. Se alguém promete{' '}
        {taxaMes.toFixed(1).replace('.', ',')}% fixos ao mês, em poucos anos superaria toda a economia do país — é
        matematicamente impossível.
      </p>
    </div>
  );
}

/** m8-l5: O teste cardíaco da volatilidade */
function TesteCardiacoVolatilidade() {
  const [valor, setValor] = useState(1000);
  const [quedaPct, setQuedaPct] = useState(35);

  const valorCents = valor * 100;
  const aposQuedaCents = Math.round(valorCents * (1 - quedaPct / 100));
  const rendaFixaCents = Math.round(valorCents * 1.01);
  const altaNecessariaPct = (1 / (1 - quedaPct / 100) - 1) * 100;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Valor investido</span>
          <span className="font-bold">{money(valorCents)}</span>
        </span>
        <TostaoSlider min={500} max={20000} step={500} value={valor} onChange={(e) => setValor(+e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Queda em cripto / ativo volátil</span>
          <span className="font-bold text-vermelho-texto">−{quedaPct}%</span>
        </span>
        <TostaoSlider
          min={10}
          max={60}
          step={5}
          value={quedaPct}
          onChange={(e) => setQuedaPct(+e.target.value)}
          tone="alerta"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-vermelho-texto">Cripto (−{quedaPct}%)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(aposQuedaCents)}</p>
        </div>
        <div className="rounded-2xl bg-menta-clara p-3">
          <span className="text-xs font-semibold text-verde-texto">Renda Fixa (+1%)</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(rendaFixaCents)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-amarelo-claro p-3 text-[13px] leading-relaxed text-laranja-texto">
        <Selo tipo="queda" />
        Depois de cair <b>−{quedaPct}%</b>, seu ativo precisa subir{' '}
        <b>+{altaNecessariaPct.toFixed(1).replace('.', ',')}%</b> só para voltar aos {money(valorCents)} iniciais!
      </div>
    </div>
  );
}

// ===========================================================================
// MÓDULO 9: Golpes, Apostas & Armadilhas
// ===========================================================================

/** m9-l1: O teste da falsa central */
function TesteFalsaCentral() {
  const CENARIOS = [
    {
      titulo: '1. SMS de compra suspeita',
      texto: '"BANCO: Compra de R$ 2.890 aprovada agora. Não reconhece? Ligue 0800-999-4120."',
      opcoes: [
        { label: 'Número 0800 enviado no SMS', correto: true },
        { label: 'O valor alto da compra', correto: false },
      ],
      explicacao:
        'Golpistas criam um 0800 falso para você ligar para a "falsa central". Sempre abra o app oficial do banco.',
    },
    {
      titulo: '2. Ligação da "segurança"',
      texto: '"Sua conta foi invadida. Para bloquear, faça um Pix para a conta segura do Banco Central."',
      opcoes: [
        { label: 'Pedir Pix para "conta segura"', correto: true },
        { label: 'Falar sobre invasão de conta', correto: false },
      ],
      explicacao: 'Nenhum banco ou Banco Central pede transferência ou Pix para proteger dinheiro. Isso é 100% golpe.',
    },
    {
      titulo: '3. Link de atualização',
      texto: '"Seu app será bloqueado hoje! Atualize seu token em: banco-seguro-atualiza.com"',
      opcoes: [
        { label: 'Domínio estranho + urgência', correto: true },
        { label: 'Mencionar token do app', correto: false },
      ],
      explicacao: 'Links fora do domínio oficial com ameaça de bloqueio imediato são phishing clássico.',
    },
  ];

  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const acertos = CENARIOS.filter((c, i) => respostas[i] !== undefined && c.opcoes[respostas[i]]?.correto).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-semibold text-tinta-suave">
        <span>Clique no sinal de golpe em cada caso:</span>
        <span className="font-bold text-tinta">{acertos}/3 identificados</span>
      </div>

      {CENARIOS.map((c, idx) => {
        const escolhida = respostas[idx];
        const acertou = escolhida !== undefined && c.opcoes[escolhida]?.correto;
        return (
          <div key={c.titulo} className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3">
            <p className="text-xs font-extrabold text-tinta">{c.titulo}</p>
            <p className="rounded-lg bg-papel-2 p-2 text-xs italic text-tinta-suave">{c.texto}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {c.opcoes.map((op, opIdx) => {
                const selected = escolhida === opIdx;
                return (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => setRespostas((prev) => ({ ...prev, [idx]: opIdx }))}
                    className={`rounded-xl px-2.5 py-2 text-left text-[12px] font-bold transition ${
                      selected
                        ? op.correto
                          ? 'bg-menta-clara text-verde-texto'
                          : 'bg-rosa text-vermelho-texto'
                        : 'border border-linha bg-papel-2 text-tinta'
                    }`}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>
            {escolhida !== undefined && (
              <p className={`text-[12px] leading-snug ${acertou ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
                <Selo tipo={acertou ? 'ok' : 'erro'} />
                {c.explicacao}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** m9-l2: A vantagem da banca */
function VantagemDaBanca() {
  const [bancaInicial, setBancaInicial] = useState(100);
  const [aposta, setAposta] = useState(10);
  const [seed, setSeed] = useState(1);

  // Simulação determinística com RTP de 95% (casa fica com 5% em média)
  const simular = (s: number) => {
    let saldo = bancaInicial;
    let x = s * 9301 + 49297;
    const pontos: number[] = [saldo];
    let jogadas = 0;

    for (let i = 1; i <= 1000; i++) {
      if (saldo < aposta) break;
      jogadas = i;
      x = (x * 16807) % 2147483647;
      const u = x / 2147483647;
      // Probabilidade de ganhar 2x: 47.5% -> RTP = 0.475 * 2 = 95%
      saldo += u < 0.475 ? aposta : -aposta;
      if (i % 200 === 0) pontos.push(saldo);
    }
    if (pontos.length < 6) pontos.push(saldo);
    return { saldoFinal: saldo, jogadas, pontos };
  };

  const { saldoFinal, jogadas, pontos } = simular(seed);
  const maxPonto = Math.max(bancaInicial, ...pontos, 1);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Banca inicial</span>
          <span className="font-bold">{money(bancaInicial * 100)}</span>
        </span>
        <TostaoSlider
          min={50}
          max={500}
          step={50}
          value={bancaInicial}
          onChange={(e) => setBancaInicial(+e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Aposta por jogada (RTP 95%)</span>
          <span className="font-bold">{money(aposta * 100)}</span>
        </span>
        <TostaoSlider min={2} max={20} step={2} value={aposta} onChange={(e) => setAposta(+e.target.value)} />
      </label>

      <button
        type="button"
        onClick={() => setSeed((s) => s + 1)}
        className="rounded-xl bg-laranja px-4 py-2.5 text-xs font-extrabold text-tinta shadow-sm transition active:scale-[0.99]"
      >
        Simular 1.000 jogadas
      </button>

      <div className="flex items-end gap-1.5 rounded-2xl bg-papel-2 p-3 h-24">
        {pontos.map((p, idx) => {
          const h = Math.max(6, Math.round((p / maxPonto) * 100));
          return (
            <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-1 h-full">
              <div
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-md ${p >= bancaInicial ? 'bg-menta' : 'bg-alerta'}`}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-papel-2 p-3">
          <span className="text-xs font-semibold text-tinta-suave">Jogadas até parar</span>
          <p className="font-display text-xl font-extrabold text-tinta">{jogadas}</p>
        </div>
        <div className={`rounded-2xl p-3 ${saldoFinal < bancaInicial ? 'bg-rosa' : 'bg-menta-clara'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Saldo final</span>
          <p className="font-display text-xl font-extrabold text-tinta">{money(saldoFinal * 100)}</p>
        </div>
      </div>
    </div>
  );
}

/** m9-l3: A quebra geométrica da pirâmide */
function QuebraGeometricaPiramide() {
  const [recrutas, setRecrutas] = useState(3);
  const [niveis, setNiveis] = useState(10);

  const BRASIL = 212_000_000;
  const TERRA = 8_000_000_000;

  const noNivel = Math.pow(recrutas, niveis);
  const totalAcumulado = (Math.pow(recrutas, niveis + 1) - 1) / (recrutas - 1);

  const passouBrasil = totalAcumulado > BRASIL;
  const passouTerra = totalAcumulado > TERRA;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-tinta">Quantas pessoas cada membro precisa recrutar:</span>
        <div className="grid grid-cols-3 gap-2">
          {[2, 3, 5].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRecrutas(k)}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                recrutas === k ? 'bg-laranja text-tinta shadow-sm' : 'border border-linha bg-cartao text-tinta-suave'
              }`}
            >
              {k} pessoas
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Nível da pirâmide</span>
          <span className="font-bold">Nível {niveis}</span>
        </span>
        <TostaoSlider min={1} max={16} value={niveis} onChange={(e) => setNiveis(+e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-laranja-texto">Só no nível {niveis}</span>
          <p className="font-display text-lg font-extrabold text-tinta">{noNivel.toLocaleString('pt-BR')}</p>
        </div>
        <div className={`rounded-2xl p-3 ${passouBrasil ? 'bg-rosa' : 'bg-papel-2'}`}>
          <span className="text-xs font-semibold text-tinta-suave">Total acumulado</span>
          <p className="font-display text-lg font-extrabold text-tinta">{totalAcumulado.toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-xs leading-relaxed text-tinta-suave">
        <Selo tipo={passouTerra || passouBrasil ? 'perigo' : 'alta'} />
        {passouTerra
          ? 'Estourou a população da Terra (8 bilhões)! Não existe mais ninguém no planeta para recrutar.'
          : passouBrasil
            ? 'Já passou de toda a população do Brasil (212 milhões). A base sempre fica sem ter quem recrutar e perde dinheiro.'
            : 'Suba mais alguns níveis para ver como a progressão geométrica esgota rapidamente a população inteira.'}
      </p>
    </div>
  );
}

/** m9-l4: O escrutínio da vaga */
function EscrutinioDaVaga() {
  const SINAIS = [
    'Pede taxa, kit ou curso pago para começar',
    'Usa e-mail gratuito (@gmail) ou só WhatsApp',
    'Promete salário irreal sem entrevista',
    'Pede foto de RG/CPF ou selfie no WhatsApp',
    'Pressão de urgência ("fecha em 30 min")',
  ];

  const [marcados, setMarcados] = useState<number[]>([0, 3]);

  const toggle = (idx: number) => {
    setMarcados((prev) => (prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]));
  };

  const score = marcados.length;
  const nivel =
    score === 0
      ? { label: 'Sem sinais de alerta', cor: 'bg-menta-clara text-verde-texto' }
      : score <= 2
        ? { label: 'Risco moderado — investigue', cor: 'bg-amarelo-claro text-laranja-texto' }
        : { label: 'Alto risco de golpe! Fuja', cor: 'bg-rosa text-vermelho-texto' };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-tinta-suave">
        Marque os sinais presentes na vaga que você recebeu:
      </span>

      <div className="flex flex-col gap-1.5">
        {SINAIS.map((sinal, idx) => {
          const ativo = marcados.includes(idx);
          return (
            <button
              key={sinal}
              type="button"
              onClick={() => toggle(idx)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                ativo ? 'border-alerta bg-rosa text-vermelho-texto' : 'border-linha bg-cartao text-tinta'
              }`}
            >
              {ativo ? (
                <Selo tipo="alerta" className="mr-0" />
              ) : (
                <span aria-hidden="true" className="inline-block h-[18px] w-[18px] rounded-full border border-linha" />
              )}
              <span>{sinal}</span>
            </button>
          );
        })}
      </div>

      <div className={`rounded-2xl p-3 text-xs font-bold ${nivel.cor}`}>
        Score: {score}/5 sinais — {nivel.label}
      </div>
    </div>
  );
}

/** m9-l5: A conta do absurdo econômico */
function ContaAbsurdoEconomico() {
  const [porVideo, setPorVideo] = useState(5);
  const [minutosDia, setMinutosDia] = useState(30);
  const [usuarios, setUsuarios] = useState(100_000);

  const videosDia = minutosDia * 2; // 30s por vídeo
  const ganhoUsuarioDiaCents = videosDia * porVideo * 100;
  const custoDiaReais = (ganhoUsuarioDiaCents / 100) * usuarios;
  const custoMesReais = custoDiaReais * 30;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-[13px] leading-[18px] font-semibold">
          <span>Valor prometido por vídeo de 30s</span>
          <span className="font-bold">{money(porVideo * 100)}</span>
        </span>
        <TostaoSlider min={1} max={15} step={1} value={porVideo} onChange={(e) => setPorVideo(+e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs font-semibold">
          <span>Minutos assistidos por dia</span>
          <span className="font-bold">
            {minutosDia} min ({videosDia} vídeos)
          </span>
        </span>
        <TostaoSlider
          min={10}
          max={120}
          step={10}
          value={minutosDia}
          onChange={(e) => setMinutosDia(+e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-tinta">Usuários na plataforma:</span>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: '10 mil', val: 10_000 },
            { label: '100 mil', val: 100_000 },
            { label: '1 milhão', val: 1_000_000 },
          ].map((u) => (
            <button
              key={u.val}
              type="button"
              onClick={() => setUsuarios(u.val)}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                usuarios === u.val
                  ? 'bg-laranja text-tinta shadow-sm'
                  : 'border border-linha bg-cartao text-tinta-suave'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amarelo-claro p-3">
          <span className="text-xs font-semibold text-laranja-texto">Custo por dia</span>
          <p className="font-display text-base font-extrabold text-tinta">{formatCompactMoney(custoDiaReais)}</p>
        </div>
        <div className="rounded-2xl bg-rosa p-3">
          <span className="text-xs font-semibold text-vermelho-texto">Custo por mês</span>
          <p className="font-display text-base font-extrabold text-tinta">{formatCompactMoney(custoMesReais)}</p>
        </div>
      </div>

      <p className="rounded-xl bg-papel-2 p-3 text-[13px] leading-relaxed text-tinta-suave">
        <Selo tipo="dinheiro" />
        Um anunciante real paga ~R$ 0,03 por visualização. Pagar {money(porVideo * 100)} por vídeo exigiria que a
        empresa queimasse <b>{formatCompactMoney(custoMesReais)}</b> todo mês — a conta não fecha!
      </p>
    </div>
  );
}
