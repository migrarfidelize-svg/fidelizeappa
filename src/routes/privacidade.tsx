import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Fidelize" },
      {
        name: "description",
        content:
          "Quais dados a Fidelize coleta, por que coleta, com quem compartilha e como você exerce seus direitos de titular sob a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Fidelize" },
      {
        property: "og:description",
        content: "Transparência total sobre coleta, uso, compartilhamento e retenção de dados na Fidelize.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function DataTable({
  rows,
}: {
  rows: { what: string; data: string; why: string; basis: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-3 py-2 font-semibold">Onde</th>
            <th className="px-3 py-2 font-semibold">Dados</th>
            <th className="px-3 py-2 font-semibold">Finalidade</th>
            <th className="px-3 py-2 font-semibold">Base legal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what} className="border-t align-top">
              <td className="px-3 py-2 font-medium">{r.what}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.data}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.why}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Legal</div>
        <h1 className="font-display text-4xl font-bold mt-1">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Versão 2.0 · Última atualização: 29 de julho de 2026 · Vigente a partir de 29 de julho de 2026
        </p>
      </div>

      <div className="rounded-xl border bg-muted/30 p-4 text-sm mb-8">
        <p className="font-medium">Resumo em linguagem simples</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
          <li>Coletamos apenas o necessário para operar o cartão fidelidade, o cardápio e as notificações.</li>
          <li>Não vendemos dados pessoais e não os usamos para treinar modelos de IA.</li>
          <li>Você pode exportar ou apagar sua conta a qualquer momento, sozinho, dentro do app.</li>
          <li>Nossos servidores e alguns fornecedores ficam fora do Brasil — explicamos isso no item 7.</li>
        </ul>
      </div>

      <article className="max-w-none space-y-8 text-[15px] leading-relaxed">
        <Section id="controlador" title="1. Quem é o responsável pelos dados">
          <p>
            A plataforma <strong>Fidelize</strong> é operada por <strong>André Ribeiro Ferreira</strong>, pessoa física
            inscrita no CPF nº <strong>***.337.941-**</strong>, estabelecido em <strong>Goiânia/GO, Brasil</strong>
            {" "}(o número completo do CPF e o endereço podem ser obtidos mediante solicitação pelos canais do item 12,
            e constam dos recibos e contratos).
          </p>
          <p>
            Atuamos como <strong>controlador</strong> em relação aos dados de quem contrata e usa a plataforma
            (donos de estabelecimento, gerentes, funcionários e clientes finais que criam conta na carteira digital).
          </p>
          <p>
            Atuamos como <strong>operador</strong> em relação aos dados de clientes finais que um estabelecimento cadastra,
            importa ou coleta usando nossas ferramentas. Nesse caso, o <strong>estabelecimento é o controlador</strong>:
            é ele quem define a finalidade, obtém consentimento quando necessário e responde primeiro ao titular.
            Nós tratamos esses dados apenas seguindo as instruções dele e o que está nos{" "}
            <Link to="/termos" className="underline text-primary">Termos de Uso</Link>.
          </p>
        </Section>

        <Section id="dados" title="2. Quais dados coletamos, para quê e com que base legal">
          <p className="text-sm text-muted-foreground">
            Esta é a lista completa do que a plataforma coleta hoje. Se lançarmos algo novo, atualizamos esta tabela.
          </p>

          <h3 className="font-medium pt-2">2.1 Conta e estabelecimento</h3>
          <DataTable
            rows={[
              {
                what: "Cadastro",
                data: "Nome completo, e-mail, senha (armazenada com hash), telefone/WhatsApp, foto de perfil (opcional)",
                why: "Criar e autenticar a conta, recuperar acesso, comunicar avisos do serviço",
                basis: "Execução de contrato",
              },
              {
                what: "Login social",
                data: "Nome, e-mail e ID público da conta Google, quando você opta por entrar com Google",
                why: "Autenticação sem senha",
                basis: "Execução de contrato",
              },
              {
                what: "Negócio",
                data: "Nome fantasia, categoria/segmento, endereço, telefone, redes sociais, logotipo, cores da marca, link público",
                why: "Montar o perfil público, cartão, cardápio e materiais de divulgação",
                basis: "Execução de contrato",
              },
              {
                what: "Equipe",
                data: "Nome, e-mail, papel (dono/gerente/funcionário) e permissões dos membros convidados",
                why: "Controle de acesso e registro de quem fez cada ação",
                basis: "Execução de contrato / legítimo interesse",
              },
              {
                what: "Assinatura",
                data: "Plano, status, histórico de cobranças, identificador da transação no gateway, últimos dígitos e bandeira do cartão",
                why: "Cobrar, liberar recursos, emitir recibo e prevenir fraude",
                basis: "Execução de contrato / obrigação legal",
              },
            ]}
          />
          <p className="text-sm">
            <strong>Nunca recebemos nem armazenamos o número completo do seu cartão, CVV ou senha bancária.</strong>{" "}
            Esses dados são digitados diretamente no ambiente do gateway de pagamento.
          </p>

          <h3 className="font-medium pt-4">2.2 Clientes finais (fidelidade)</h3>
          <DataTable
            rows={[
              {
                what: "Cadastro do cliente",
                data: "Nome, telefone, e-mail (opcional), data de nascimento (opcional), observações do lojista",
                why: "Identificar o cliente no balcão, aplicar carimbos e resgatar recompensas",
                basis: "Execução de contrato (com o lojista) / consentimento do titular",
              },
              {
                what: "Cartão fidelidade",
                data: "Carimbos, data e hora, funcionário que carimbou, recompensas resgatadas, nível (bronze a diamante), conquistas",
                why: "Operar o programa de fidelidade e evitar fraude no carimbo",
                basis: "Execução de contrato",
              },
              {
                what: "Importação em massa",
                data: "Dados de clientes enviados pelo lojista via planilha CSV",
                why: "Migrar uma base existente para a plataforma",
                basis: "Responsabilidade do lojista (ver item 3)",
              },
              {
                what: "Carteira digital",
                data: "Passe Apple Wallet / Google Wallet, identificador do dispositivo que instalou o passe",
                why: "Manter o cartão atualizado no celular do cliente",
                basis: "Consentimento (ao adicionar o passe)",
              },
            ]}
          />

          <h3 className="font-medium pt-4">2.3 Engajamento, notificações e canais públicos</h3>
          <DataTable
            rows={[
              {
                what: "Notificações push",
                data: "Token de inscrição do navegador/dispositivo, tipo de dispositivo, data de inscrição, entregas e cliques",
                why: "Enviar avisos de carimbo, recompensa e campanhas autorizadas",
                basis: "Consentimento (permissão do navegador, revogável)",
              },
              {
                what: "QR Code e Bio Commerce",
                data: "Contagem de leituras e cliques, link acessado, data/hora, tipo de dispositivo e origem aproximada da visita",
                why: "Mostrar ao lojista quais canais trazem clientes",
                basis: "Legítimo interesse (métricas agregadas)",
              },
              {
                what: "Avaliações",
                data: "Nota, respostas do formulário, comentário em texto livre e, se você informar, nome e contato",
                why: "Dar retorno ao estabelecimento e permitir que ele resolva o atendimento",
                basis: "Consentimento do avaliador",
              },
              {
                what: "Cardápio e catálogo",
                data: "Itens favoritados, visualizações e, quando o lojista ativa pedidos, nome, contato e itens do pedido",
                why: "Exibir o cardápio, registrar preferências e processar o pedido",
                basis: "Execução de contrato / consentimento",
              },
              {
                what: "Suporte",
                data: "Mensagens, tickets, anexos enviados e histórico de atendimento",
                why: "Atender sua solicitação e melhorar a base de conhecimento",
                basis: "Execução de contrato / legítimo interesse",
              },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Não coletamos sua localização em tempo real (GPS). A localização aproximada mencionada acima vem apenas do
            endereço IP e é usada de forma agregada.
          </p>

          <h3 className="font-medium pt-4">2.4 Técnicos e de segurança</h3>
          <DataTable
            rows={[
              {
                what: "Logs de acesso",
                data: "Endereço IP, data/hora, navegador e sistema operacional, páginas acessadas",
                why: "Segurança, investigação de incidentes e cumprimento do Marco Civil (art. 15)",
                basis: "Obrigação legal / legítimo interesse",
              },
              {
                what: "Auditoria",
                data: "Registro de ações sensíveis (quem carimbou, quem excluiu, quem mudou permissão ou plano)",
                why: "Rastreabilidade e resolução de disputas entre lojista e equipe",
                basis: "Legítimo interesse",
              },
              {
                what: "Assistente de IA",
                data: "O texto da pergunta que você digita no assistente e o contexto público da página",
                why: "Gerar a resposta automática",
                basis: "Legítimo interesse (ver item 6)",
              },
            ]}
          />
        </Section>

        <Section id="operador" title="3. Se você é um estabelecimento usando a Fidelize">
          <p>
            Ao cadastrar, importar ou coletar dados de clientes na plataforma, <strong>você é o controlador</strong> desses
            dados e assume as seguintes obrigações:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>ter base legal válida para cada dado coletado, inclusive nas importações por planilha;</li>
            <li>obter consentimento específico antes de enviar mensagens de marketing, e respeitar o opt-out;</li>
            <li>informar seus clientes sobre a existência desta plataforma e desta política;</li>
            <li>responder às solicitações de titulares dos seus clientes (podemos ajudar tecnicamente);</li>
            <li>não inserir dados sensíveis (saúde, biometria, religião, opinião política) nos campos livres;</li>
            <li>comunicar-nos imediatamente se suspeitar de vazamento envolvendo a sua conta.</li>
          </ul>
          <p>
            Como operador, nós: tratamos os dados só conforme suas instruções e estes documentos, mantemos sigilo,
            aplicamos as medidas de segurança do item 8, avisamos você sobre incidentes conforme o item 9 e,
            ao término do contrato, devolvemos (exportação) ou eliminamos os dados conforme o item 10.
          </p>
        </Section>

        <Section id="nao-fazemos" title="4. O que nós não fazemos">
          <ul className="list-disc pl-6 space-y-1">
            <li>Não vendemos, alugamos nem cedemos dados pessoais a terceiros para fins comerciais.</li>
            <li>Não usamos seus dados nem os dados dos seus clientes para treinar modelos de inteligência artificial.</li>
            <li>Não usamos cookies de publicidade comportamental de terceiros nem pixels de rastreamento de anunciantes.</li>
            <li>Não fazemos decisões automatizadas com efeito jurídico sobre você (a classificação em níveis de fidelidade é um benefício, não uma restrição de direitos).</li>
            <li>Não vasculhamos o conteúdo das mensagens entre lojista e cliente, exceto quando estritamente necessário para suporte solicitado ou por ordem legal.</li>
          </ul>
        </Section>

        <Section id="compartilhamento" title="5. Com quem compartilhamos (subprocessadores)">
          <p>Compartilhamos apenas o necessário, com fornecedores que sustentam a operação:</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Fornecedor</th>
                  <th className="px-3 py-2 font-semibold">Para quê</th>
                  <th className="px-3 py-2 font-semibold">País</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Lovable Cloud / Supabase", "Banco de dados, autenticação e armazenamento de arquivos", "EUA"],
                  ["Cloudflare", "Rede de entrega, proteção contra ataques e execução do aplicativo", "EUA / global"],
                  ["Resend", "Envio de e-mails transacionais e avisos", "EUA"],
                  ["Mercado Pago", "Processamento de assinaturas e pagamentos", "Brasil"],
                  ["Asaas", "Processamento de assinaturas e pagamentos (quando habilitado)", "Brasil"],
                  ["Google (Gemini) via gateway de IA", "Respostas do assistente virtual", "EUA"],
                  ["Google Wallet / Apple Wallet", "Emissão do passe do cartão fidelidade no celular", "EUA"],
                  ["Serviços de push do navegador (Google/Apple/Mozilla)", "Entrega das notificações push", "EUA / global"],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{a}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Também podemos compartilhar dados com autoridades públicas mediante ordem judicial ou requisição legal válida,
            e com advogados/contadores sob dever de sigilo quando necessário para defender nossos direitos.
          </p>
          <p className="text-sm text-muted-foreground">
            Esta lista pode mudar. Avisaremos com antecedência mínima de 15 dias sobre a inclusão de um novo
            subprocessador que trate dados de clientes finais.
          </p>
        </Section>

        <Section id="ia" title="6. Uso de inteligência artificial">
          <p>
            A plataforma oferece um assistente virtual e recursos de sugestão de texto. Quando você usa esses recursos,
            o conteúdo que você digita é enviado a um provedor de IA (atualmente Google Gemini, por meio de um gateway)
            exclusivamente para gerar a resposta.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Não enviamos automaticamente sua base de clientes para o provedor de IA.</li>
            <li>O conteúdo enviado não é usado para treinar modelos.</li>
            <li>Evite digitar dados pessoais de terceiros nos campos do assistente.</li>
            <li>As respostas são geradas automaticamente e podem conter erros — não substituem orientação profissional.</li>
          </ul>
        </Section>

        <Section id="internacional" title="7. Transferência internacional de dados">
          <p>
            Parte da nossa infraestrutura e alguns fornecedores estão localizados <strong>fora do Brasil</strong>,
            principalmente nos Estados Unidos (ver item 5). Isso significa que seus dados podem ser armazenados e
            processados no exterior.
          </p>
          <p>
            Essas transferências ocorrem com fundamento no art. 33 da LGPD, por serem <strong>necessárias à execução do
            contrato</strong> firmado com você, e são amparadas por cláusulas contratuais de proteção de dados firmadas
            com cada fornecedor, que impõem obrigações de segurança e confidencialidade compatíveis com a legislação
            brasileira. Ao usar a plataforma, você está ciente dessa transferência.
          </p>
        </Section>

        <Section id="seguranca" title="8. Segurança da informação">
          <ul className="list-disc pl-6 space-y-1">
            <li>Criptografia em trânsito (HTTPS/TLS) e em repouso no banco de dados.</li>
            <li>Senhas armazenadas apenas como hash — nem nós conseguimos lê-las.</li>
            <li>Isolamento por estabelecimento com regras de acesso no próprio banco (Row-Level Security).</li>
            <li>Controle de acesso por papel e permissões individuais por membro da equipe.</li>
            <li>Registros de auditoria das ações sensíveis.</li>
            <li>Acesso administrativo restrito e revisado periodicamente.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Nenhum sistema é 100% inviolável. Aplicamos medidas compatíveis com o porte e o risco da operação, mas não
            podemos garantir segurança absoluta — inclusive contra falhas causadas pelo uso indevido da sua senha.
          </p>
        </Section>

        <Section id="incidentes" title="9. Incidentes de segurança">
          <p>
            Se ocorrer incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
            comunicaremos os afetados e a ANPD nos termos do art. 48 da LGPD, em prazo razoável e não superior a
            <strong> 3 dias úteis</strong> a partir do conhecimento do fato, informando os dados envolvidos, os riscos e
            as medidas adotadas.
          </p>
          <p>
            Para relatar uma vulnerabilidade ou suspeita de incidente, escreva para{" "}
            <strong>dpo@fidelize.app</strong>. Analisamos relatos de boa-fé e não tomamos medidas contra pesquisadores
            que reportem falhas de forma responsável e sem exfiltrar dados de terceiros.
          </p>
        </Section>

        <Section id="retencao" title="10. Por quanto tempo guardamos">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Dado</th>
                  <th className="px-3 py-2 font-semibold">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Conta e dados do estabelecimento", "Enquanto a conta existir"],
                  ["Após cancelamento do plano", "30 dias para exportação; depois eliminação ou anonimização"],
                  ["Após pedido de exclusão da conta", "Eliminação em até 30 dias"],
                  ["Clientes finais e histórico de carimbos", "Enquanto o estabelecimento mantiver a conta, ou até ele excluir o cliente"],
                  ["Eventos de uso, marketing e leituras de QR Code", "90 dias (exclusão automática diária)"],
                  ["Registros de envio de e-mail, push e webhooks", "180 dias (exclusão automática diária)"],
                  ["Eventos de retenção, níveis e uso de IA", "12 meses"],
                  ["Logs de acesso (IP, data/hora)", "6 meses (Marco Civil, art. 15)"],
                  ["Registros de auditoria administrativa", "5 anos, em formato inalterável (não podem ser editados nem apagados)"],
                  ["Registros fiscais e de pagamento", "5 anos (legislação tributária)"],
                  ["Registro de consentimento (IP, navegador, versão aceita)", "5 anos após o fim da relação, como prova do aceite"],
                  ["Tickets de suporte", "24 meses após o encerramento"],
                  ["Tokens de notificação push", "Até a revogação da permissão ou 12 meses sem uso"],
                  ["Métricas agregadas e anonimizadas", "Por prazo indeterminado (não identificam pessoas)"],
                ].map(([a, b]) => (
                  <tr key={a} className="border-t align-top">
                    <td className="px-3 py-2 font-medium">{a}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="direitos" title="11. Seus direitos como titular (LGPD art. 18)">
          <p>Gratuitamente e a qualquer momento, você pode:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>confirmar se tratamos dados seus e acessá-los;</li>
            <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
            <li>solicitar a portabilidade dos dados a outro fornecedor;</li>
            <li>obter informação sobre com quem compartilhamos seus dados;</li>
            <li>revogar o consentimento e se descadastrar de comunicações de marketing;</li>
            <li>opor-se a tratamento feito com base em legítimo interesse;</li>
            <li>peticionar diretamente à ANPD.</li>
          </ul>
          <p>
            <strong>Como exercer:</strong> se você tem conta ativa, exporte ou exclua seus dados sozinho em{" "}
            <Link to="/lgpd" className="underline text-primary font-medium">Meus Dados</Link>. Se você é cliente final de
            um estabelecimento, procure primeiro o próprio estabelecimento — ele é o controlador. Se não obtiver resposta,
            escreva para nós e intermediamos. Respondemos em até <strong>15 dias</strong>.
          </p>
        </Section>

        <Section id="menores" title="12. Crianças e adolescentes">
          <p>
            A plataforma não se destina a menores de 18 anos. Não criamos contas de estabelecimento para menores.
            Um cliente final menor de 16 anos só pode participar de um programa de fidelidade com consentimento
            específico e destacado de pelo menos um dos pais ou responsável legal, cuja obtenção é responsabilidade do
            estabelecimento. Se soubermos que coletamos dados de criança sem esse consentimento, eliminaremos o registro.
          </p>
        </Section>

        <Section id="cookies" title="13. Cookies e tecnologias similares">
          <p>Usamos apenas duas categorias de armazenamento local:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Essenciais:</strong> sessão de login, preferência de tema (claro/escuro), estado do aplicativo
              instalado (PWA) e proteção contra abuso. Não podem ser desativados sem quebrar o serviço.
            </li>
            <li>
              <strong>Funcionais e de medição própria:</strong> contagem de acessos ao cartão, ao cardápio e à árvore de
              links, sempre de forma agregada e sem perfilamento publicitário.
            </li>
          </ul>
          <p>
            Não utilizamos cookies de publicidade de terceiros. Você pode limpar ou bloquear o armazenamento local nas
            configurações do seu navegador; nesse caso, será necessário fazer login novamente.
          </p>
        </Section>

        <Section id="contato" title="14. Encarregado (DPO) e contato">
          <p>
            Encarregado pelo Tratamento de Dados Pessoais: <strong>André Ribeiro Ferreira</strong>.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Privacidade, direitos de titular e incidentes: <strong>dpo@fidelize.app</strong></li>
            <li>Suporte e assuntos comerciais: <strong>contato@fidelize.app</strong></li>
            <li>Autoridade Nacional de Proteção de Dados: <span className="text-muted-foreground">gov.br/anpd</span></li>
          </ul>
        </Section>

        <Section id="alteracoes" title="15. Alterações desta política">
          <p>
            Podemos atualizar este documento para refletir mudanças no produto ou na lei. Alterações materiais serão
            comunicadas por e-mail e por aviso dentro da plataforma com antecedência mínima de <strong>15 dias</strong>.
            O histórico de versões fica indicado no topo desta página. Continuar usando a plataforma após a vigência
            significa concordar com a versão atualizada.
          </p>
        </Section>
      </article>

      <div className="mt-10 text-sm text-muted-foreground border-t pt-6">
        Veja também nossos <Link to="/termos" className="underline">Termos de Uso</Link>.
      </div>
    </main>
  );
}
