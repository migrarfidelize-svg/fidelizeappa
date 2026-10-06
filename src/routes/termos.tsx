import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Fidelize" },
      {
        name: "description",
        content:
          "Condições de contratação, pagamento, cancelamento, responsabilidades e regras de uso da plataforma Fidelize.",
      },
      { property: "og:title", content: "Termos de Uso — Fidelize" },
      {
        property: "og:description",
        content: "Regras claras de assinatura, uso aceitável, propriedade dos dados e cancelamento na Fidelize.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosPage,
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="font-display text-4xl font-bold mt-1">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Versão 2.0 · Última atualização: 29 de julho de 2026 · Vigente a partir de 29 de julho de 2026
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-sm mb-8">
        <p className="font-medium">Resumo em linguagem simples</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
          <li>Você assina um plano mensal ou anual e pode cancelar quando quiser, sem multa.</li>
          <li>Os dados dos seus clientes são seus — você exporta a qualquer momento.</li>
          <li>Você é responsável pelo conteúdo que publica e pelo consentimento dos seus clientes.</li>
          <li>Nossa responsabilidade é limitada ao valor pago nos últimos 12 meses.</li>
        </ul>
      </div>

      <article className="max-w-none space-y-8 text-[15px] leading-relaxed">
        <Section id="partes" title="1. Quem contrata e quem presta o serviço">
          <p>
            O serviço <strong>Fidelize</strong> é prestado por <strong>André Ribeiro Ferreira</strong>, CPF nº{" "}
            <strong>***.337.941-**</strong>, com sede em <strong>Goiânia/GO, Brasil</strong> ("Fidelize", "nós").
            O número completo do CPF e o endereço são informados nos recibos e mediante solicitação em{" "}
            <strong>contato@fidelize.app</strong>.
          </p>
          <p>
            "Você" ou "Assinante" é a pessoa física ou jurídica que cria uma conta de estabelecimento.
            "Cliente final" é o consumidor que participa de um programa de fidelidade de um Assinante.
          </p>
        </Section>

        <Section id="aceitacao" title="2. Aceitação">
          <p>
            Ao criar uma conta, contratar um plano ou usar a plataforma, você declara que leu, entendeu e concorda com
            estes Termos e com a{" "}
            <Link to="/privacidade" className="underline text-primary">Política de Privacidade</Link>, que é parte
            integrante deste contrato. Se você aceita em nome de uma empresa, declara ter poderes para isso.
            Se não concorda, não utilize o serviço.
          </p>
        </Section>

        <Section id="objeto" title="3. O que a plataforma faz">
          <p>
            A Fidelize é um software como serviço (SaaS) que oferece, conforme o plano contratado: cartão fidelidade
            digital, base de clientes, campanhas e cupons, notificações push, avaliações de atendimento, cardápio e
            catálogo digital, Bio Commerce, QR Codes, materiais de divulgação, relatórios e atendimento ao cliente.
          </p>
          <p>
            A plataforma é uma <strong>ferramenta</strong>. Não garantimos aumento de vendas, retorno de clientes ou
            qualquer resultado comercial específico.
          </p>
        </Section>

        <Section id="conta" title="4. Cadastro e conta">
          <ul className="list-disc pl-6 space-y-1">
            <li>É necessário ter 18 anos ou mais e capacidade civil para contratar.</li>
            <li>Você é responsável pela veracidade dos dados informados e deve mantê-los atualizados.</li>
            <li>A senha é pessoal e intransferível; toda ação feita com suas credenciais é atribuída a você.</li>
            <li>É proibido criar conta em nome de terceiros sem autorização.</li>
            <li>Você é responsável pelos acessos que conceder à sua equipe e pelas permissões atribuídas.</li>
            <li>Contas gratuitas sem qualquer atividade por mais de 12 meses podem ser suspensas ou removidas, mediante aviso prévio por e-mail.</li>
          </ul>
        </Section>

        <Section id="planos" title="5. Planos, pagamento, reajuste e cancelamento">
          <ul className="list-disc pl-6 space-y-1">
            <li>Os preços e limites de cada plano estão publicados na página <Link to="/precos" className="underline">Preços</Link>.</li>
            <li>Cobranças recorrentes (mensais ou anuais) são processadas por gateways parceiros — Mercado Pago e Asaas — nas formas de pagamento disponíveis (PIX, cartão ou boleto).</li>
            <li>A renovação é <strong>automática</strong> até que você cancele.</li>
            <li>
              <strong>Arrependimento:</strong> você pode desistir em até 7 dias corridos da primeira contratação e receber
              reembolso integral (CDC, art. 49). Após esse prazo, não há reembolso proporcional de período já iniciado.
            </li>
            <li>
              <strong>Inadimplência:</strong> se o pagamento falhar, a assinatura entra em atraso; após 10 dias sem
              regularização, o acesso ao painel é bloqueado. Os dados são preservados por 30 dias adicionais.
            </li>
            <li>
              <strong>Cancelamento:</strong> pode ser feito a qualquer momento, sem multa, pelo próprio painel.
              O serviço permanece ativo até o fim do período já pago.
            </li>
            <li>
              <strong>Reajuste:</strong> os preços podem ser reajustados no máximo uma vez a cada 12 meses, com aviso
              prévio de 30 dias por e-mail. Se você não concordar, pode cancelar antes da vigência sem qualquer ônus.
            </li>
            <li>
              <strong>Mudança de plano:</strong> upgrades passam a valer imediatamente com cobrança proporcional;
              downgrades passam a valer no próximo ciclo e podem desativar recursos e exceder limites do novo plano.
            </li>
          </ul>
        </Section>

        <Section id="uso" title="6. Uso aceitável">
          <p>É expressamente proibido:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>enviar spam, phishing, correntes ou mensagens enganosas a clientes finais;</li>
            <li>coletar ou importar dados de pessoas sem base legal ou consentimento válido;</li>
            <li>publicar conteúdo ilícito, ofensivo, discriminatório, que viole direitos autorais ou de imagem;</li>
            <li>oferecer produtos proibidos ou de venda restrita a menores sem controle adequado;</li>
            <li>fraudar carimbos, recompensas ou avaliações, inclusive criando avaliações falsas;</li>
            <li>fazer engenharia reversa, copiar, revender ou sublicenciar a plataforma;</li>
            <li>usar robôs, scraping ou automações que sobrecarreguem a infraestrutura;</li>
            <li>tentar acessar dados de outro estabelecimento ou burlar controles de segurança;</li>
            <li>usar o serviço para atividade ilícita ou que viole direitos de terceiros.</li>
          </ul>
          <p>
            <strong>Uso justo:</strong> mesmo em planos sem limite numérico declarado, o uso deve ser compatível com uma
            operação comercial legítima. Consumo abusivo (envios em massa, armazenamento desproporcional de mídia,
            requisições automatizadas) pode ser limitado após aviso.
          </p>
        </Section>

        <Section id="conteudo" title="7. Conteúdo publicado por você">
          <p>
            Logotipo, fotos, textos, cardápio, preços, descrições de produtos e mensagens enviadas são de sua inteira
            responsabilidade. Você declara ter os direitos necessários sobre esse conteúdo e nos concede licença
            limitada, não exclusiva e revogável para hospedá-lo e exibi-lo dentro da plataforma e nos seus canais
            públicos (perfil, cardápio, Bio Commerce).
          </p>
          <p>
            Podemos remover conteúdo manifestamente ilegal ou que viole estes Termos, notificando você sempre que
            possível.
          </p>
        </Section>

        <Section id="dados" title="8. Propriedade dos dados e proteção de dados">
          <p>
            Os dados de clientes finais que você cadastra permanecem <strong>sob sua titularidade e controle</strong>.
            Você é o <strong>controlador</strong> e a Fidelize é <strong>operadora</strong>, nos termos da LGPD.
            As obrigações de cada parte estão detalhadas no item 3 da{" "}
            <Link to="/privacidade" className="underline text-primary">Política de Privacidade</Link>, que funciona como
            nosso acordo de tratamento de dados (DPA).
          </p>
          <p>
            Você pode exportar sua base a qualquer momento, em formato aberto, pelo próprio painel. Após o encerramento
            da conta, mantemos os dados por 30 dias para exportação e depois os eliminamos ou anonimizamos.
          </p>
          <p>
            O software, o código, a marca "Fidelize", o design e os materiais da plataforma são de nossa propriedade
            exclusiva. Nada nestes Termos transfere propriedade intelectual a você.
          </p>
        </Section>

        <Section id="ia" title="9. Recursos de inteligência artificial">
          <p>
            Recursos assistidos por IA geram sugestões automáticas que podem conter imprecisões. Você deve revisar todo
            conteúdo antes de publicá-lo ou enviá-lo a clientes, e é o único responsável pelo uso que fizer dele.
            Esses recursos podem ter limites de uso por plano e podem ser alterados ou descontinuados.
          </p>
        </Section>

        <Section id="disponibilidade" title="10. Disponibilidade e suporte">
          <p>
            Empregamos <strong>melhores esforços</strong> para manter a plataforma disponível de forma contínua, mas o
            serviço é fornecido "como está", sem garantia de disponibilidade ininterrupta ou livre de erros.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Manutenções programadas são comunicadas com antecedência sempre que possível.</li>
            <li>Não respondemos por indisponibilidade causada por terceiros (provedores de internet, gateways de pagamento, serviços de push, lojas de aplicativos) ou por caso fortuito e força maior.</li>
            <li>O suporte é prestado em português, por e-mail e pelo canal de atendimento dentro da plataforma, em dias úteis, com prazos que variam conforme o plano.</li>
          </ul>
        </Section>

        <Section id="responsabilidade" title="11. Limitação de responsabilidade">
          <p>
            Na máxima extensão permitida pela legislação aplicável, a responsabilidade total da Fidelize por quaisquer
            danos decorrentes do uso da plataforma limita-se ao <strong>valor efetivamente pago por você nos 12 meses
            anteriores</strong> ao evento que originou a demanda.
          </p>
          <p>
            Não respondemos por lucros cessantes, perda de oportunidade de negócio, danos indiretos, nem por decisões
            comerciais tomadas com base em relatórios da plataforma. Nada nesta cláusula afasta direitos que a
            legislação consumerista brasileira garante de forma inafastável.
          </p>
        </Section>

        <Section id="indenizacao" title="12. Indenização">
          <p>
            Você concorda em nos indenizar por perdas, custos e despesas razoáveis decorrentes de reclamação de terceiro
            causada por: conteúdo que você publicou, uso indevido da plataforma, coleta de dados de clientes sem base
            legal, ou violação destes Termos.
          </p>
        </Section>

        <Section id="rescisao" title="13. Suspensão e rescisão">
          <p>
            Podemos suspender ou encerrar contas que violem estes Termos ou a lei, com notificação prévia sempre que
            possível — ou imediatamente, em caso de risco à segurança, fraude ou ordem legal. Em caso de encerramento por
            nossa iniciativa sem culpa sua, reembolsaremos proporcionalmente o período pago e não utilizado.
          </p>
          <p>
            Você pode encerrar sua conta a qualquer momento em{" "}
            <Link to="/lgpd" className="underline text-primary">Meus Dados</Link>. Exporte seus dados antes: a exclusão é
            definitiva após o prazo de 30 dias.
          </p>
        </Section>

        <Section id="alteracoes" title="14. Alterações destes Termos">
          <p>
            Podemos alterar estes Termos para refletir mudanças no produto ou na legislação. Alterações materiais serão
            comunicadas por e-mail e por aviso na plataforma com antecedência mínima de <strong>15 dias</strong>.
            Se você não concordar, pode cancelar antes da vigência. Continuar usando após esse prazo significa aceitação.
          </p>
        </Section>

        <Section id="geral" title="15. Disposições gerais">
          <ul className="list-disc pl-6 space-y-1">
            <li>Estes Termos e a Política de Privacidade constituem o acordo integral entre as partes.</li>
            <li>A tolerância quanto a qualquer descumprimento não implica renúncia de direitos.</li>
            <li>Se alguma cláusula for considerada inválida, as demais permanecem em vigor.</li>
            <li>Você não pode ceder este contrato sem nosso consentimento; podemos cedê-lo em caso de reorganização societária, mediante aviso.</li>
            <li>Comunicações oficiais são feitas para o e-mail cadastrado na sua conta.</li>
          </ul>
        </Section>

        <Section id="foro" title="16. Lei aplicável e foro">
          <p>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. As partes buscarão solução amigável
            antes de qualquer medida judicial. Para relações de consumo, fica eleito o foro do domicílio do consumidor,
            conforme o CDC. Nos demais casos, fica eleito o foro da comarca de <strong>Goiânia/GO</strong>.
          </p>
        </Section>
      </article>

      <div className="mt-10 text-sm text-muted-foreground border-t pt-6">
        Dúvidas: <strong>contato@fidelize.app</strong> · Privacidade e Encarregado (LGPD):{" "}
        <strong>dpo@fidelize.app</strong> · Veja também a{" "}
        <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
      </div>
    </main>
  );
}
