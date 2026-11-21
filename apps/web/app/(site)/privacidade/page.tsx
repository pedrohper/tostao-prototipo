import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/lib/i18n-server';
import { Contato, Controlador, LegalPage, Resumo, Tabela, disp } from '../legal';

export const metadata: Metadata = {
  title: 'Política de privacidade · Tostão',
  description: 'Que dados o Tostão usa, pra quê, com quem e como apagar. Conforme a LGPD.',
};

export default async function PrivacidadePage() {
  const { t } = await getI18n();
  return (
    <LegalPage title={t.legal.privacyTitle}>
      <Resumo>
        <ul>
          <li>
            Usamos seus dados só pra fazer o Tostão funcionar pra você. Não vendemos, não mostramos anúncio e não usamos
            rastreador.
          </li>
          <li>
            Seus dados ficam num banco de dados protegido, em infraestrutura de nuvem. A senha é guardada embaralhada
            (hash), nem a gente consegue ler.
          </li>
          <li>
            Pra conversa com o Tostão e a categoria automática, e só se você der o seu aceite, um resumo dos seus
            números, com dados pessoais mascarados, vai pra um serviço de inteligência artificial (DeepSeek), fora do
            Brasil.
          </li>
          <li>Você pode ver, corrigir, baixar uma cópia (JSON), desconectar e apagar tudo quando quiser, no Perfil.</li>
        </ul>
      </Resumo>

      <h2 className={disp}>1. Quem cuida dos seus dados</h2>
      <p>
        O controlador dos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), é{' '}
        <Controlador />, responsável pelo Tostão. Para qualquer assunto de privacidade, inclusive exercer seus direitos,
        fale com o nosso encarregado pelo tratamento de dados pessoais (DPO): <Contato dpo />.
      </p>

      <h2 className={disp}>2. Que dados usamos</h2>
      <Tabela>
        <thead>
          <tr>
            <th>Dado</th>
            <th>De onde vem</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nome, e-mail e senha (guardada só como hash)</td>
            <td>Você, ao criar a conta</td>
          </tr>
          <tr>
            <td>Contas, saldos, transações, faturas e limites de cartão</td>
            <td>Seus bancos, pela Pluggy (Open Finance), ou o extrato que você importa</td>
          </tr>
          <tr>
            <td>Gastos anotados na mão, categorias, limites, renda, dia do salário, contas fixas e meta</td>
            <td>Você, dentro do app</td>
          </tr>
          <tr>
            <td>Acertos: nomes de pessoas e anotações ligadas a divisões, empréstimos ou dívidas</td>
            <td>Você, dentro do app</td>
          </tr>
          <tr>
            <td>Progresso nas lições, missões feitas por dia, ofensiva e respostas dos desafios</td>
            <td>Seu uso do app</td>
          </tr>
          <tr>
            <td>Amigos que você adicionou (por código ou convite)</td>
            <td>Você</td>
          </tr>
          <tr>
            <td>Endereço de avisos do navegador (só se você ligar os avisos no celular)</td>
            <td>Seu navegador</td>
          </tr>
          <tr>
            <td>Mensagens da conversa com o Tostão</td>
            <td>Você, no app ou no WhatsApp</td>
          </tr>
          <tr>
            <td>Número do WhatsApp (só se você ligar essa função)</td>
            <td>Você</td>
          </tr>
          <tr>
            <td>Cookies e armazenamento do navegador (lista completa na seção 6), endereço IP e horário de acesso</td>
            <td>Seu navegador, automaticamente</td>
          </tr>
        </tbody>
      </Tabela>
      <p>
        Não pedimos CPF, documento, foto nem localização. As transações podem conter nomes de outras pessoas (por
        exemplo, quem te mandou um Pix); usamos isso só pra organizar o seu extrato.
      </p>

      <h2 className={disp}>3. Pra que usamos e com que base legal</h2>
      <Tabela>
        <thead>
          <tr>
            <th>Finalidade</th>
            <th>Base legal (LGPD, art. 7º)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              Criar e manter sua conta, sincronizar bancos, categorizar gastos, mostrar resumo, previsão, limites,
              acertos e meta, liberar lições
            </td>
            <td>
              Execução do contrato que você aceita nos <Link href="/termos">Termos de uso</Link> (inciso V)
            </td>
          </tr>
          <tr>
            <td>Conectar seus bancos pelo Open Finance</td>
            <td>Seu consentimento, dado no ambiente do banco e revogável a qualquer momento (inciso I)</td>
          </tr>
          <tr>
            <td>Responder na conversa com o Tostão e sugerir categorias com inteligência artificial</td>
            <td>Execução do contrato (inciso V); você pode não usar a conversa e categorizar na mão</td>
          </tr>
          <tr>
            <td>Segurança: limite de tentativas de login, registros de acesso, backup</td>
            <td>Legítimo interesse de proteger você e o serviço (inciso IX)</td>
          </tr>
          <tr>
            <td>Guardar registros quando a lei mandar</td>
            <td>Cumprimento de obrigação legal (inciso II)</td>
          </tr>
        </tbody>
      </Tabela>
      <p>
        Não usamos seus dados pra publicidade, não traçamos perfil pra vender a ninguém e não tomamos decisões
        automáticas que afetem seus direitos (como crédito).
      </p>

      <h2 className={disp}>4. Com quem compartilhamos</h2>
      <p>Só com quem é necessário pra o app funcionar, sempre o mínimo:</p>
      <ul>
        <li>
          <b>Pluggy</b> (Brasil): faz a conexão com os bancos pelo Open Finance e nos entrega as transações. Recebe a
          sua autorização de acesso; não recebe seu nome nem sua senha do Tostão.
        </li>
        <li>
          <b>DeepSeek</b> (China): serviço de inteligência artificial usado na conversa com o Tostão e na categoria
          automática, <b>só depois do seu aceite</b> (você pode revogar quando quiser). Antes de enviar, nós mascaramos
          dados pessoais (CPF, e-mail, telefone, chaves Pix e nomes em transações). Recebe seu primeiro nome, suas
          mensagens e um resumo dos seus números (saldos, gastos por categoria, renda, assinaturas, limites e meta) ou a
          descrição e o valor das transações sem categoria. Não recebe e-mail, senha nem dados de acesso ao banco.
        </li>
        <li>
          <b>Resend</b> (Estados Unidos): envia os e-mails da sua conta (verificação de e-mail e redefinição de senha).
          Recebe seu nome, seu e-mail e o texto da mensagem.
        </li>
        <li>
          <b>Meta (WhatsApp Cloud API)</b> (Estados Unidos): só se você ligar o Tostão no WhatsApp. As mensagens dessa
          conversa e o seu número passam pela plataforma oficial do WhatsApp.
        </li>
        <li>
          <b>Seus amigos no Tostão</b>: só quem você adicionou vê seu primeiro nome, sua ofensiva e quantas missões você
          fez na semana. Nunca saldo, gasto ou banco.
        </li>
        <li>
          <b>Serviço de avisos do seu navegador</b> (Google, Apple ou Mozilla, conforme o aparelho): só se você ligar os
          avisos. Leva o texto do aviso (ex.: "Fatura vence em 2 dias") até o seu celular.
        </li>
        <li>
          <b>Provedor de hospedagem (infraestrutura de nuvem)</b>: onde o site, a API e o banco de dados rodam. Guarda
          seus dados criptografados em trânsito (HTTPS) e sob acesso restrito, apenas pra manter o serviço no ar.
        </li>
        <li>
          <b>Sentry</b> (Estados Unidos): ferramenta de monitoramento de erros, assim que for ativada no serviço. Recebe
          só detalhes técnicos de falhas (tela, tipo do erro), nunca saldos, transações ou mensagens.
        </li>
        <li>
          <b>Autoridades</b>, se uma lei ou ordem judicial obrigar.
        </li>
      </ul>
      <p>
        <b>Transferência internacional.</b> DeepSeek, Resend, Meta, Sentry e o serviço de avisos do navegador ficam fora
        do Brasil (e a hospedagem também, se a região contratada for de outro país). Essa transferência acontece pra
        executar o serviço que você pediu (LGPD, art. 33, inciso IX). Se você não quiser que seus números saiam do
        Brasil, basta não usar a conversa com o Tostão nem a categoria automática.
      </p>

      <h2 className={disp}>5. Onde e por quanto tempo guardamos</h2>
      <ul>
        <li>
          Os dados ficam num banco de dados em infraestrutura de nuvem, fechado pra internet e com acesso só por HTTPS e
          por quem precisa operar o serviço.
        </li>
        <li>
          Guardamos enquanto sua conta existir. Quando você apaga a conta, tudo some do sistema na hora, e as cópias de
          backup (diárias) são descartadas em até 14 dias.
        </li>
        <li>Quando você desconecta um banco, as contas e transações vindas dele são apagadas na hora.</li>
        <li>
          Registros técnicos de acesso são guardados só pelo tempo necessário pra segurança ou pelo prazo que a lei
          exigir.
        </li>
      </ul>

      <h2 className={disp}>6. Cookies e armazenamento do navegador</h2>
      <p>
        Usamos apenas cookies essenciais e funcionais. Não usamos cookies de publicidade nem ferramentas de análise ou
        rastreamento. Todos são nossos (nenhum é de terceiros):
      </p>
      <Tabela>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Pra que serve</th>
            <th>Duração</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>tostao_token</td>
            <td>Mantém você logado (chave de acesso, protegida contra leitura por scripts)</td>
            <td>15 minutos, renovado sozinho</td>
          </tr>
          <tr>
            <td>tostao_refresh</td>
            <td>Renova a sessão sem pedir a senha de novo (revogável: sair da conta o invalida)</td>
            <td>30 dias</td>
          </tr>
          <tr>
            <td>tostao_oauth</td>
            <td>Segurança do login com Google ou Apple (evita login forjado)</td>
            <td>10 minutos</td>
          </tr>
          <tr>
            <td>tostao-tema</td>
            <td>Lembra o tema que você escolheu (claro, escuro ou do aparelho)</td>
            <td>1 ano</td>
          </tr>
          <tr>
            <td>tostao-inicio</td>
            <td>Lembra o que você escolheu mostrar ou esconder na tela Início</td>
            <td>1 ano</td>
          </tr>
          <tr>
            <td>tostao-locale</td>
            <td>Lembra o idioma, quando mais de um estiver disponível</td>
            <td>1 ano</td>
          </tr>
          <tr>
            <td>tostao-flash</td>
            <td>Mostra o aviso de “salvo” depois de uma ação (ex.: “Lançamento apagado”)</td>
            <td>30 segundos</td>
          </tr>
        </tbody>
      </Tabela>
      <p>
        Também guardamos no próprio aparelho (armazenamento local do navegador, que não é enviado a ninguém) pequenas
        preferências: se o saldo fica escondido, se os sons estão ligados, se você dispensou o convite pra instalar o
        app, desafios aceitos e lições já vistas. Apagar os dados do site no navegador remove tudo isso.
      </p>

      <h2 className={disp}>7. Seus direitos</h2>
      <p>A LGPD (art. 18) te garante, a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
        <li>corrigir dados incompletos ou errados;</li>
        <li>pedir anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>portabilidade dos seus dados (em Perfil, “Baixar meus dados (JSON)”, em até 2 vezes por dia);</li>
        <li>eliminar os dados tratados com base no seu consentimento e revogar esse consentimento;</li>
        <li>saber com quem compartilhamos (está na seção 4);</li>
        <li>reclamar na Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.</li>
      </ul>
      <p>
        Muita coisa você faz sozinho no app: editar categorias, renda e meta,{' '}
        <b>baixar uma cópia de todos os seus dados</b> em formato JSON, desconectar um banco e{' '}
        <b>apagar a conta inteira</b> em Perfil, Apagar minha conta. Pro resto, fale com o nosso encarregado (DPO):{' '}
        <Contato dpo />. Respondemos em até 15 dias.
      </p>

      <h2 className={disp}>8. Segurança</h2>
      <p>
        Senha guardada com hash (bcrypt), conexão sempre por HTTPS, cookie de sessão protegido contra leitura por
        scripts, limite de tentativas de login e acesso ao banco só leitura. Nenhum sistema é 100% seguro: se acontecer
        um incidente que possa te prejudicar, avisamos você e a ANPD, como manda a lei.
      </p>

      <h2 className={disp}>9. Menores de idade</h2>
      <p>O Tostão é só pra maiores de 18 anos. Se descobrirmos uma conta de menor, ela é apagada.</p>

      <h2 className={disp}>10. Mudanças nesta política</h2>
      <p>
        Se mudarmos algo importante (por exemplo, um novo parceiro que recebe dados), avisamos no app antes de valer. A
        data no topo mostra a versão atual.
      </p>
    </LegalPage>
  );
}
