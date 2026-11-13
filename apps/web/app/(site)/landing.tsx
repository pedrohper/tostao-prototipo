// Landing pública. Igual às telas 20 (desktop) e 21 (celular) do artefato "Telas do Tostão":
// é uma página só, responsiva. Quem já está logado nem vê: a raiz manda pro /inicio.
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { SiteFooter, SiteHeader } from './chrome';
import s from './site.module.css';

const MODULOS = ['Saindo da neblina', 'Cartão sem armadilha', 'Construindo o muro', 'Investir em você', 'Primeiro salário', 'Abrindo o cofre', 'Bolsa sem hype', 'Defesa pessoal'];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E7A55" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );
}

const cta = `${s.btn} ${s['btn-dark']}`;
const ghost = `${s.btn} ${s['btn-ghost']}`;

export function Landing({ contaApagada = false }: { contaApagada?: boolean }) {
  return (
    <div className={s.lp}>
      <div className={s.wrap}>
        <SiteHeader home />
        {contaApagada && <p role="status" className={s.aviso}>Sua conta foi apagada, junto com todos os seus dados. Valeu por ter testado o Tostão.</p>}

        <section className={s.hero}>
          <div>
            <h1 className={s.disp}>Grana explicada, de <span className={s.mark}>tostão em tostão</span></h1>
            <p>Conecte seu banco, veja pra onde o dinheiro foi e aprenda com os seus próprios gastos, em lições de 2 minutos. Sem sermão.</p>
            <div className={s['hero-ctas']}>
              <Link href="/criar-conta" className={cta}>Começar grátis</Link>
              <a href="#como" className={ghost}>Ver como funciona</a>
            </div>
            <div className={s.trust}>
              <span><Check />Open Finance regulado pelo Banco Central</span>
              <span><Check />Só leitura, nunca movimenta seu dinheiro</span>
            </div>
          </div>
          <div className={s['hero-art']} aria-hidden="true">
            <img className={s.pig} src="/elenco/acenando.webp" alt="" />
            <div className={`${s.card} ${s.saldo}`}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B635A' }}>Saldo em 3 contas</span>
              <span className={s.disp} style={{ fontSize: 34, lineHeight: '38px', fontVariantNumeric: 'tabular-nums' }}>R$ 842,30</span>
              <div className={s.bar}><div style={{ width: '16%', background: '#1E1B18' }} /><div style={{ width: '67%', background: '#FF5A36' }} /><div style={{ width: '17%', background: '#3DD6A0' }} /></div>
            </div>
            <div className={s.dica}>Eita, <b>R$ 312,40 em delivery</b> esse mês. Tem uma lição de 2 minutos sobre isso.</div>
          </div>
        </section>
      </div>

      <section className={`${s.sec} ${s['sec-alt']}`} id="como">
        <div className={s.wrap}>
          <span className={s.eyebrow}>Como funciona</span>
          <h2 className={s.disp}>Três passos e seu dinheiro sai da neblina</h2>
          <div className={s.steps}>
            <div className={`${s.card} ${s.step}`}><img src="/elenco/conectando.webp" alt="Tostão conectando o banco" /><span className={s.num}>1</span><h3 className={s.disp}>Conecte seus bancos</h3><p>Nubank, Mercado Pago, Bradesco e outros, todos num lugar só, pelo Open Finance.</p></div>
            <div className={`${s.card} ${s.step}`}><img src="/elenco/investigando.webp" alt="Tostão investigando com uma lupa" /><span className={s.num}>2</span><h3 className={s.disp}>Veja pra onde foi</h3><p>O Tostão organiza seus gastos e te avisa quando alguma coisa sai do normal.</p></div>
            <div className={`${s.card} ${s.step}`}><img src="/elenco/professor.webp" alt="Tostão professor" /><span className={s.num}>3</span><h3 className={s.disp}>Aprenda com o seu extrato</h3><p>Lições curtas que usam os seus gastos de verdade e terminam numa decisão sua.</p></div>
          </div>
        </div>
      </section>

      <section className={s.sec} id="aprender">
        <div className={`${s.wrap} ${s.split}`}>
          <div>
            <span className={s.eyebrow}>Aprender</span>
            <h2 className={s.disp}>Nada de decoreba. Cada lição é sobre o seu dinheiro</h2>
            <p className={s.lead}>Do primeiro salário ao primeiro investimento, em 9 módulos. Você vê o conceito, brinca com os números e sai com um desafio que o app confere no extrato.</p>
            <div className={s.mods}>{MODULOS.map((m) => <span key={m}>{m}</span>)}</div>
          </div>
          <div className={`${s.card} ${s.licao}`}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B635A' }}>Módulo 1 · 2 min</span>
            <span className={s.disp} style={{ fontSize: 28, lineHeight: '32px' }}>Seu dinheiro é uma pizza</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B635A' }}>O ideal</span>
              <div className={s.bar}><div style={{ width: '50%', background: '#1E1B18' }} /><div style={{ width: '30%', background: '#FF5A36' }} /><div style={{ width: '20%', background: '#3DD6A0' }} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6B635A' }}>O seu novembro</span>
              <div className={s.bar}><div style={{ width: '16%', background: '#1E1B18' }} /><div style={{ width: '84%', background: '#FF5A36' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <img src="/elenco/preocupado.webp" alt="Tostão preocupado" style={{ width: 84, height: 84, flex: 'none' }} />
              <div style={{ background: '#FFE1E7', borderRadius: '16px 16px 16px 4px', padding: '11px 13px', fontSize: 15, lineHeight: '21px', marginBottom: 8 }}>Os desejos comeram a pizza quase inteira. Normal no começo. Bora treinar?</div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${s.sec} ${s['sec-alt']}`}>
        <div className={s.wrap}>
          <span className={s.eyebrow}>A turma</span>
          <h2 className={s.disp}>Dois amigos do seu lado, dois vilões que todo mundo de 20 anos já encontrou</h2>
          <img src="/elenco/turma.webp" alt="Urubu do Pix, Caramelo, Tostão e Tigrinho lado a lado" style={{ width: '100%', maxWidth: 720, height: 'auto', margin: '8px auto 20px', display: 'block' }} />
          <div className={s.vils}>
            <div className={s.vil} style={{ background: '#FFE1E7' }}><img src="/elenco/orgulhoso.webp" alt="Tostão orgulhoso de braços cruzados" /><span className={s.tag}>Herói</span><h3 className={s.disp}>Tostão</h3><p>Cofrinho que já quebrou e se remendou. Fala a real sobre dinheiro, sem sermão.</p></div>
            <div className={s.vil} style={{ background: '#DDF6E8' }}><img src="/elenco/caramelo.webp" alt="Caramelo sentado, sorrindo" /><span className={s.tag}>Herói</span><h3 className={s.disp}>Caramelo</h3><p>Vira-lata de rua que fareja pechincha, chorinho no Pix e desperdício no mercado.</p></div>
            <div className={s.vil} style={{ background: '#FFF1C7' }}><img src="/elenco/tigrinho.webp" alt="Tigrinho de óculos escuros e correntes de ouro" /><span className={s.tag}>Vilão</span><h3 className={s.disp}>Tigrinho</h3><p>Ostenta, canta e jura que hoje a cartinha solta. É a bet que nunca devolve.</p></div>
            <div className={s.vil} style={{ background: '#DCEBFF' }}><img src="/elenco/urubu-pix.webp" alt="Urubu do Pix mostrando o celular" /><span className={s.tag}>Vilão</span><h3 className={s.disp}>Urubu do Pix</h3><p>Robô que rende 10% ao dia, falsa central, pirâmide do amigo. Some quando você precisa.</p></div>
          </div>
        </div>
      </section>

      <section className={s.sec} id="seguranca">
        <div className={s.wrap}>
          <span className={s.eyebrow}>Segurança</span>
          <h2 className={s.disp}>Seu dinheiro fica onde está</h2>
          <div className={s.seg}>
            <div className={s.card}><h3 className={s.disp}>Só leitura</h3><p>O Tostão vê suas transações pra te ajudar, mas não faz Pix, não paga conta e não mexe em nada.</p></div>
            <div className={s.card}><h3 className={s.disp}>Open Finance</h3><p>A conexão usa o Open Finance, o sistema oficial regulado pelo Banco Central, com a sua autorização.</p></div>
            <div className={s.card}><h3 className={s.disp}>Você manda</h3><p>Desconecte um banco ou apague seus dados quando quiser, direto no Perfil. Tudo explicado na <Link href="/privacidade">Política de privacidade</Link>.</p></div>
          </div>
        </div>
      </section>

      <div className={s.wrap}>
        <section className={s.final}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start' }}>
            <h2 className={s.disp}>Bora sair da neblina?</h2>
            <p style={{ margin: 0, fontSize: 18, lineHeight: '27px', maxWidth: 520 }}>Grátis pra começar. Leva 2 minutos pra fazer a primeira lição, mesmo sem conectar banco.</p>
            <Link href="/criar-conta" className={cta}>Começar grátis</Link>
          </div>
          <img src="/elenco/dupla.webp" alt="Tostão e Caramelo lado a lado" />
        </section>
        <SiteFooter />
      </div>
    </div>
  );
}
