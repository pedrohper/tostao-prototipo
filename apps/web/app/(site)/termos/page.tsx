import type { Metadata } from 'next';
import Link from 'next/link';
import { Contato, LegalPage, Resumo, disp } from '../legal';

export const metadata: Metadata = { title: 'Termos de uso · Tostão', description: 'As regras pra usar o Tostão, em português de gente.' };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de uso">
      <Resumo>
        <ul>
          <li>O Tostão organiza seu dinheiro e ensina finanças. Ele só lê seus dados: não faz Pix, não paga conta, não mexe em nada.</li>
          <li>É pra maiores de 18 anos e está em fase de testes (beta), grátis.</li>
          <li>O Tostão ensina critérios. Ele não é banco, não é consultoria e não recomenda investimentos. A decisão é sempre sua.</li>
          <li>Você pode desconectar um banco ou apagar a conta quando quiser, no Perfil.</li>
        </ul>
      </Resumo>

      <h2 className={disp}>1. O que é o Tostão</h2>
      <p>O Tostão é um app de finanças pessoais e educação financeira para jovens. Ele junta as transações das suas contas, organiza seus gastos em categorias, mostra previsões e limites, e oferece lições curtas e uma conversa com o Tostão, o assistente do app. Ao criar uma conta, você concorda com estes Termos e com a <Link href="/privacidade">Política de privacidade</Link>.</p>

      <h2 className={disp}>2. Quem pode usar</h2>
      <ul>
        <li>Pessoas com 18 anos ou mais, morando no Brasil.</li>
        <li>Uma conta por pessoa, com nome e e-mail verdadeiros. A conta é sua e não pode ser emprestada ou vendida.</li>
        <li>Você cuida da sua senha. Se achar que alguém entrou na sua conta, troque a senha e fale com a gente.</li>
      </ul>

      <h2 className={disp}>3. O que o Tostão faz e o que ele não faz</h2>
      <ul>
        <li><b>Só leitura.</b> A conexão com os bancos só permite ler saldos, transações e faturas. O Tostão não consegue fazer pagamentos, transferências ou qualquer movimentação.</li>
        <li><b>Não é instituição financeira.</b> O Tostão não guarda seu dinheiro, não empresta, não vende produto financeiro e não intermedia investimentos.</li>
        <li><b>Educação, não recomendação.</b> As lições, os simuladores e as respostas do Tostão são conteúdo educativo. Nada aqui é recomendação de investimento, consultoria financeira, jurídica ou tributária.</li>
        <li><b>A inteligência artificial erra.</b> A conversa com o Tostão e a categoria automática usam inteligência artificial e podem errar números, categorias ou explicações. Confira no seu banco antes de tomar uma decisão importante.</li>
        <li><b>Os números podem atrasar.</b> Os dados vêm dos bancos e podem chegar com atraso ou diferença em relação ao app do banco. O extrato oficial é sempre o do seu banco.</li>
      </ul>

      <h2 className={disp}>4. Conexão com os bancos</h2>
      <p>A conexão é feita pela Pluggy, empresa que acessa os dados pelo Open Finance, o sistema regulado pelo Banco Central. Você autoriza o compartilhamento no próprio ambiente do seu banco, escolhe o que compartilhar e por quanto tempo, e pode revogar essa autorização a qualquer momento no banco ou desconectando o banco no Perfil do Tostão. Se preferir não conectar, dá pra importar o extrato (OFX ou CSV) ou anotar os gastos na mão.</p>

      <h2 className={disp}>5. Uso correto</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>usar o Tostão para qualquer coisa ilegal, inclusive fraude ou lavagem de dinheiro;</li>
        <li>conectar contas que não são suas ou que você não tem permissão para ver;</li>
        <li>tentar invadir, sobrecarregar ou copiar o app, ou acessar dados de outras pessoas;</li>
        <li>usar a conversa com o Tostão para gerar conteúdo ofensivo ou abusar do limite diário de mensagens.</li>
      </ul>
      <p>Se isso acontecer, podemos suspender ou encerrar a conta.</p>

      <h2 className={disp}>6. Fase de testes</h2>
      <p>O Tostão está em beta. Funcionalidades podem mudar, aparecer ou sumir, e o app pode ficar fora do ar de vez em quando (ele roda num servidor próprio). Fazemos backup diário, mas não prometemos que o serviço vai estar sempre disponível ou livre de erros.</p>

      <h2 className={disp}>7. Preço</h2>
      <p>Hoje o Tostão é grátis. Se um dia tiver plano pago, você vai saber antes, com o preço claro, e nada vai ser cobrado sem você aceitar. O que já é grátis no seu uso atual não passa a ser cobrado sem aviso.</p>

      <h2 className={disp}>8. Marca e conteúdo</h2>
      <p>O nome Tostão, os personagens (Tostão, Caramelo, Urubu do Pix e Tigrinho), as lições e o visual do app são do Tostão. Você pode compartilhar prints do seu fechamento do mês e das lições, mas não pode copiar o app ou usar a marca como se fosse sua. Seus dados continuam sendo seus.</p>

      <h2 className={disp}>9. Responsabilidade</h2>
      <p>As decisões sobre o seu dinheiro são suas. O Tostão não se responsabiliza por perdas que venham de decisões tomadas com base no app, de informações erradas vindas dos bancos ou de períodos fora do ar, nos limites que a lei permite. Nada aqui tira os direitos que o Código de Defesa do Consumidor te garante.</p>

      <h2 className={disp}>10. Encerrar a conta</h2>
      <p>Você pode apagar sua conta quando quiser em Perfil, Apagar minha conta. Os bancos são desconectados e seus dados são apagados, como explica a <Link href="/privacidade">Política de privacidade</Link>.</p>

      <h2 className={disp}>11. Mudanças nestes Termos</h2>
      <p>Se mudarmos algo importante, avisamos no app antes de valer. Continuar usando depois do aviso significa que você concorda com a nova versão. Se não concordar, é só apagar a conta.</p>

      <h2 className={disp}>12. Lei e foro</h2>
      <p>Estes Termos seguem as leis do Brasil. Qualquer disputa pode ser resolvida no foro da sua cidade.</p>

      <h2 className={disp}>13. Contato</h2>
      <p>Dúvidas sobre estes Termos: <Contato />.</p>
    </LegalPage>
  );
}
