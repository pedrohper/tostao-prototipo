# Feature: Reorganização de Ver mais, Perfil e Tostão (Análises)

- **Data:** 2026-11-16
- **Branch:** `feat/mais-perfil-tostao-ux`
- **Status:** 🎉 entregue

## Problema / Objetivo

A aba **Ver mais** (`/mais`) hoje concentra formulários extensos de contas conectadas, configurações do Tostão, notificações, preferências e ações de conta na mesma tela, gerando excesso de rolagem no celular (Galaxy S24). Ao mesmo tempo, a aba **Perfil** (`/perfil`) exibe apenas nível/conquistas sem centralizar a gestão da conta, e a aba **Tostão** usa o rótulo `"No automático"` e um botão textual largo `"Dar uma olhada agora"` ao lado do título.

Objetivo: transformar `/mais` em um menu limpo estilo app nativo (com entrada para **Minha carteira** e sub-telas dedicadas), centralizar gestão da conta em `/perfil`, renomear `"No automático"` para **Análises** e trocar o botão textual por um ícone compacto de refresh ao lado de **O que o Tostão achou**.

## Escopo

**Inclui:**

- Menu enxuto em `/mais` com:
  1. Card do **Perfil** (`/perfil?voltar=/mais`) + banner de erro Open Finance (somente se houver erro).
  2. Linha **Minha carteira** (`/carteira/editar?voltar=/mais`) substituindo toda a seção expandida de contas/conexões/importação.
  3. Sub-tela dedicada **WhatsApp & Alertas** (`/mais/alertas`) contendo atalho do WhatsApp, painel `TostaoAutoConfigPanel` e `PushNotificationCard`.
  4. Sub-tela dedicada **Preferências** (`/mais/preferencias`) contendo Sons, Idioma e Personalizar Início.
  5. Sub-tela dedicada **Sobre & Legal** (`/mais/sobre`) contendo Termos, Privacidade e banner informativo do protótipo.
- Expansão de `/perfil` para centralizar identidade, nível/XP, conquistas e **gestão de conta** (`Desconectar bancos`, `Apagar conta`, `Sair`, além de `Continuar trilha`).
- Atualização dos links internos que apontavam para `/mais#avisos` (`tostao/page.tsx`, `engajamento.tsx`) para `/mais/alertas`.
- Na aba `/tostao`:
  - Renomear a segunda aba (`tabAuto`) para **Análises** (PT-BR: `Análises` · EN: `Insights` · ES: `Análisis`).
  - Trocar o botão `"Dar uma olhada agora"` em `TostaoFindingsBoard` por um **ícone compacto de refresh** posicionado ao lado de `"O que o Tostão achou"` (com animação de giro durante o `isPending` e `aria-label` acessível).

**Não inclui (fica para depois):**

- Alteração no schema Prisma ou nos endpoints de backend (reaproveita `/me`, `/tostao/auto`, `/whatsapp`, `/push/key` e `/carteira/editar`).
- Edição de nome/e-mail ou troca de senha inline dentro de `/perfil` (mantém fluxo existente de redefinição/exclusão).

## Critérios de aceite

- [x] Dado acesso a `/mais`, quando a tela carregar no S24 ou desktop, então aparecem apenas o card de Perfil e as linhas limpas (**Minha carteira**, **WhatsApp & Alertas**, **Preferências**, **Sobre & Legal**), sem listas de contas nem checkboxes inline.
- [x] Dado toque em **Minha carteira** no `/mais`, então navega para `/carteira/editar?voltar=/mais` e o botão Voltar retorna para `/mais`.
- [x] Dado toque em **WhatsApp & Alertas** (`/mais/alertas`), **Preferências** (`/mais/preferencias`) ou **Sobre & Legal** (`/mais/sobre`), então cada sub-tela abre com botão Voltar para `/mais` e todas as ações funcionam normalmente.
- [x] Dado acesso a `/perfil`, então o usuário vê identidade, XP/conquistas e todas as ações da conta (`Desconectar bancos`, `Apagar conta`, `Sair`).
- [x] Dado acesso a `/tostao`, então a segunda aba exibe **Análises** (PT-BR) e o título **O que o Tostão achou** traz apenas um botão ícone de refresh (`≥ 44px` área de toque) ao lado do título/badge, funcionando tanto no Início (modo compacto) quanto em `/tostao?aba=automatico`.

## Plataforma / UX (Brief de UX/UI)

**Plataforma:** App mobile-first (PWA / Galaxy S24) · **Entrada:** Toque (alvos `≥ 44px`), desktop (`lg+`) como adaptação em 2 colunas · **Breakpoints alvo:** `360–430px` (principal) e `≥ 1024px` (adaptação).  
**Usuário:** Pessoa usando Tostão no celular para revisar configurações ou checar análises rápidas · **Tarefa principal:** Encontrar qualquer ajuste de carteira, alertas, perfil ou preferências em ≤ 2 toques.

### Fluxo

1. Usuário toca em **Ver mais** (`/mais`) → vê lista enxuta de 4 seções + card de Perfil no topo.
2. Toca em **Minha carteira** → abre `/carteira/editar?voltar=/mais` (mesma tela já usada na Carteira).
3. Toca em **WhatsApp & Alertas**, **Preferências** ou **Sobre & Legal** → abre a sub-tela dedicada com `BackLink` para `/mais`.
4. Toca no card do **Perfil** → abre `/perfil` com conquistas e ações da conta.
5. Na aba **Tostão → Análises**, toca no ícone de refresh ao lado de **O que o Tostão achou** → dispara `runTostaoCheckAction()`, gira o ícone durante a checagem e atualiza os achados.

### Estados obrigatórios

Vazio · Carregando (`animate-spin` no ícone de refresh) · Erro (banner inline em `TostaoFindingsBoard`) · Sucesso (banner de novos achados ou tudo em dia) · Sem permissão (redirect `/entrar`).

### ⚠️ Conflitos evitados

- Evitado repetir `AddAccountBox` / lista de conexões dentro de `/mais` (duplicava `/carteira/editar` e violava a Lei de Hick).
- Evitado usar botão de texto longo ao lado do título no mobile 360px; o ícone de refresh mantém área de toque `44px × 44px` (`h-10 w-10` / `min-h-11`) sem quebrar o cabeçalho.

## Impacto técnico

| Camada             | Arquivo / recurso                                                                                                                                         | Mudança                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Banco / API        | —                                                                                                                                                         | Nenhuma mudança necessária                                                                                                                 |
| UI (Ver mais)      | `apps/web/app/(app)/mais/page.tsx`                                                                                                                        | Simplificar para card Perfil + menu de sub-rotas (`Minha carteira`, `WhatsApp & Alertas`, `Preferências`, `Sobre & Legal`)                 |
| UI (Sub-rotas)     | `apps/web/app/(app)/mais/alertas/page.tsx`, `preferencias/page.tsx`, `sobre/page.tsx`                                                                     | Criar 3 sub-telas focadas usando `PageFrame` + `BackLink`                                                                                  |
| UI (Perfil)        | `apps/web/app/(app)/perfil/page.tsx`                                                                                                                      | Receber ações de conta (`Desconectar bancos`, `Apagar conta`, `Sair`)                                                                      |
| UI (Tostão / i18n) | `apps/web/components/tostao-auto-card.tsx`, `apps/web/app/(app)/tostao/page.tsx`, `apps/web/components/engajamento.tsx`, `apps/web/lib/i18n-locales/*.ts` | Trocar `tabAuto` para **Análises**, atualizar `/mais#avisos` → `/mais/alertas`, trocar botão `"Dar uma olhada agora"` por ícone de refresh |

## Riscos e dúvidas em aberto

- Garantir que links antigos `/mais#avisos` e `?voltar=/mais` em sub-páginas (`/conectar`, `/whatsapp`, `/importar`, `/inicio/personalizar`, `/perfil/apagar-conta`) continuem retornando para o ponto certo.
