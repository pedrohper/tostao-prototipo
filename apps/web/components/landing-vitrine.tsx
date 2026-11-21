'use client';
// Vitrine da landing (T4.5): abas com mockups em HTML/CSS das telas reais do app, com DADOS FICTÍCIOS (dito no
// rótulo de cada tela). Não são screenshots: o app muda, o mockup acompanha os mesmos tokens e fica nítido em
// qualquer tamanho. As abas seguem o padrão ARIA (setas, Home e End; só a aba ativa entra na ordem do Tab).
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import s from '@/app/(site)/site.module.css';
import { VITRINE_TABS, type VitrineTabId } from '@/lib/landing-content';

const tabId = (id: VitrineTabId) => `vt-tab-${id}`;
const panelId = (id: VitrineTabId) => `vt-panel-${id}`;

function Bar({ parts }: { parts: [number, string][] }) {
  return (
    <div className={s.bar}>
      {parts.map(([w, c]) => (
        <div key={c} style={{ width: `${w}%`, background: c }} />
      ))}
    </div>
  );
}

function Fake({ children }: { children: ReactNode }) {
  return <div className={s['vt-mini']}>{children}</div>;
}

function MockInicio() {
  return (
    <>
      <div className={s['vt-top']}>
        <b>Olá, Ana</b>
        <span className={s['vt-pill']}>novembro</span>
      </div>
      <Fake>
        <span className={s['vt-muted']}>Saldo em 3 contas</span>
        <span className={`${s.disp} ${s['vt-big']}`}>R$ 842,30</span>
        <Bar
          parts={[
            [16, 'var(--color-tinta-fixa)'],
            [67, 'var(--color-laranja)'],
            [17, 'var(--color-menta)'],
          ]}
        />
      </Fake>
      <span className={s['vt-label']}>Pra onde foi</span>
      {(
        [
          ['Mercado', 'R$ 520', 78, '#3dd6a0'],
          ['Delivery', 'R$ 312', 47, '#ff5a36'],
          ['Transporte', 'R$ 140', 21, '#ffc233'],
        ] as const
      ).map(([name, value, w, color]) => (
        <div key={name} className={s['vt-cat']}>
          <span className={s['vt-dot']} style={{ background: color }} />
          <span className={s['vt-cat-name']}>{name}</span>
          <span className={s['vt-cat-bar']}>
            <i style={{ width: `${w}%`, background: color }} />
          </span>
          <b>{value}</b>
        </div>
      ))}
      <span className={s['vt-cta']}>+ Anotar gasto</span>
    </>
  );
}

function MockChat() {
  return (
    <>
      <div className={s['vt-top']}>
        <b>Tostão</b>
        <span className={s['vt-pill']}>IA</span>
      </div>
      <div className={s['vt-user']}>Quanto gastei em delivery?</div>
      <div className={s['vt-bot']}>
        Em novembro você gastou <b>R$ 312,40</b> em delivery. Quer definir um limite?
      </div>
      <Fake>
        <span className={s['vt-label']}>Delivery em novembro</span>
        <span className={`${s.disp} ${s['vt-big']}`}>R$ 312,40</span>
        <span className={s['vt-muted']}>7 lançamentos</span>
        <span className={s['vt-link']}>Ver lançamentos</span>
      </Fake>
      <div className={s['vt-chips']}>
        <span>Qual o limite de Delivery?</span>
        <span>E no mês passado?</span>
      </div>
    </>
  );
}

function MockWhatsapp() {
  return (
    <>
      <div className={`${s['vt-top']} ${s['vt-top-wa']}`}>
        <b>Tostão</b>
        <span className={s['vt-muted']}>online</span>
      </div>
      <div className={`${s['vt-user']} ${s['vt-wa-out']}`}>anota 45 de pizza ontem</div>
      <div className={`${s['vt-bot']} ${s['vt-wa-in']}`}>
        Vou anotar: <b>Pizza, R$ 45,00</b>, ontem. Responda <b>SIM</b> pra confirmar.
      </div>
      <div className={`${s['vt-user']} ${s['vt-wa-out']}`}>SIM</div>
      <div className={`${s['vt-bot']} ${s['vt-wa-in']}`}>Anotado: Pizza, -R$ 45,00.</div>
    </>
  );
}

function MockAssinaturas() {
  return (
    <>
      <div className={s['vt-top']}>
        <b>Assinaturas</b>
      </div>
      {(
        [
          ['nov', '05', 'Netflix', 'R$ 55,90'],
          ['nov', '07', 'Spotify', 'R$ 21,90'],
          ['nov', '12', 'Academia', 'R$ 89,90'],
        ] as const
      ).map(([mes, dia, nome, valor]) => (
        <div key={nome} className={s['vt-sub']}>
          <span className={s['vt-cal']}>
            <small>{mes}</small>
            <b>{dia}</b>
          </span>
          <span className={s['vt-sub-name']}>{nome}</span>
          <b>{valor}</b>
        </div>
      ))}
      <Fake>
        <span className={s['vt-muted']}>Total</span>
        <b>R$ 167,70 por mês</b>
        <span className={s['vt-muted']}>R$ 2.012,40 por ano</span>
      </Fake>
    </>
  );
}

function MockSimuladores() {
  return (
    <>
      <div className={s['vt-top']}>
        <b>Ralo do cafezinho</b>
      </div>
      {(
        [
          ['Cada gastinho', 'R$ 20,00', 50],
          ['Vezes por semana', '4x', 50],
        ] as const
      ).map(([label, value, pct]) => (
        <div key={label} className={s['vt-slider']}>
          <span className={s['vt-slider-head']}>
            {label} <b>{value}</b>
          </span>
          <span className={s['vt-track']}>
            <i style={{ width: `${pct}%` }} />
            <em style={{ left: `${pct}%` }} />
          </span>
        </div>
      ))}
      <div className={s['vt-tiles']}>
        <div style={{ background: 'var(--lp-yellow)' }}>
          <span className={s['vt-muted']}>Em 3 meses</span>
          <b className={s.disp}>R$ 1.040</b>
        </div>
        <div style={{ background: 'var(--lp-pink)' }}>
          <span className={s['vt-muted']}>Em 1 ano</span>
          <b className={s.disp}>R$ 4.160</b>
        </div>
      </div>
    </>
  );
}

const MOCKS: Record<VitrineTabId, () => ReactNode> = {
  inicio: MockInicio,
  chat: MockChat,
  whatsapp: MockWhatsapp,
  assinaturas: MockAssinaturas,
  simuladores: MockSimuladores,
};

export function LandingVitrine() {
  const [active, setActive] = useState<VitrineTabId>(VITRINE_TABS[0]!.id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ids = VITRINE_TABS.map((t) => t.id);

  const move = (e: KeyboardEvent<HTMLButtonElement>, from: number) => {
    const last = ids.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (from + 1) % ids.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (from - 1 + ids.length) % ids.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const id = ids[next]!;
    setActive(id);
    refs.current[id]?.focus();
  };

  return (
    <div className={s.vitrine}>
      <div role="tablist" aria-label="Telas do Tostão" aria-orientation="vertical" className={s['vt-tabs']}>
        {VITRINE_TABS.map((t, i) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={tabId(t.id)}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls={panelId(t.id)}
              tabIndex={on ? 0 : -1}
              data-on={on || undefined}
              className={s['vt-tab']}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => move(e, i)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {VITRINE_TABS.map((t) => {
        const Mock = MOCKS[t.id];
        return (
          <div
            key={t.id}
            id={panelId(t.id)}
            role="tabpanel"
            aria-labelledby={tabId(t.id)}
            hidden={t.id !== active}
            className={s['vt-panel']}
          >
            <div className={s['vt-copy']}>
              <h3 className={s.disp}>{t.title}</h3>
              <p>{t.body}</p>
              <ul>
                {t.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
            <div className={s['vt-phone-wrap']}>
              <div role="img" aria-label={t.mockAlt} className={s['vt-phone']}>
                <div className={s['vt-screen']} aria-hidden="true">
                  <Mock />
                </div>
              </div>
              <span className={s['vt-caption']}>Exemplo com dados fictícios</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
