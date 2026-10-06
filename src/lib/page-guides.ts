/**
 * Passo a passo por aba do painel do lojista.
 * Cada entrada é oferecida uma única vez, na primeira visita da aba.
 */
export type GuideStep = { title: string; description: string };
export type PageGuide = { title: string; subtitle: string; steps: GuideStep[] };

export const PAGE_GUIDES: Record<string, PageGuide> = {
  "/app": {
    title: "Visão geral",
    subtitle: "O painel do seu negócio",
    steps: [
      { title: "Primeiros passos", description: "O checklist do topo mostra o que falta configurar para o programa de fidelidade rodar sozinho." },
      { title: "Indicadores do dia", description: "Carimbos, clientes novos e prêmios resgatados são atualizados em tempo real." },
      { title: "Atalhos rápidos", description: "Use os blocos de atalho para carimbar, convidar a equipe ou abrir o QR sem passar pelo menu." },
    ],
  },

  "/app/carimbar": {
    title: "Carimbar cliente",
    subtitle: "Como registrar uma visita em segundos",
    steps: [
      { title: "Localize o cliente", description: "Busque por nome, WhatsApp ou leia o QR Code individual do cliente com a câmera." },
      { title: "Confirme o carimbo", description: "Toque em Carimbar. O cartão do cliente é atualizado na hora, mesmo com ele olhando o celular." },
      { title: "Prêmio liberado", description: "Quando o cartão completa, aparece o aviso de resgate — confirme a entrega para zerar o ciclo." },
      { title: "Sem internet?", description: "O app guarda os carimbos feitos offline e sincroniza sozinho quando a conexão voltar." },
    ],
  },
  "/app/clientes": {
    title: "Base de clientes",
    subtitle: "Seu CRM de fidelidade",
    steps: [
      { title: "Filtre e busque", description: "Use a busca e os filtros por nível (bronze a diamante) e atividade para achar quem importa." },
      { title: "Importe sua lista", description: "Tem clientes em planilha? Use a importação CSV para trazer todo mundo de uma vez." },
      { title: "Histórico completo", description: "Abra um cliente para ver visitas, carimbos, prêmios e toda a auditoria daquele relacionamento." },
      { title: "Ações em massa", description: "Selecione vários clientes para exportar ou disparar comunicação segmentada." },
    ],
  },
  "/app/campanhas": {
    title: "Campanhas",
    subtitle: "Regras do seu cartão fidelidade",
    steps: [
      { title: "Crie a campanha", description: "Defina quantos carimbos são necessários e qual é a recompensa." },
      { title: "Personalize o cartão", description: "Ajuste cores, ícone do selo e texto que o cliente vê na carteira digital." },
      { title: "Acompanhe resultados", description: "Veja carimbos, resgates e clientes ativos de cada campanha em tempo real." },
    ],
  },
  "/app/retencao": {
    title: "Retenção",
    subtitle: "Automação que traz o cliente de volta",
    steps: [
      { title: "Níveis de fidelidade", description: "Configure os limites de bronze, prata, ouro e diamante conforme a frequência da sua operação." },
      { title: "Gatilhos automáticos", description: "Ative aniversário e reengajamento de inativos — o sistema envia sozinho." },
      { title: "Meça o impacto", description: "Acompanhe os disparos e quantos clientes voltaram após cada automação." },
    ],
  },
  "/app/avaliacoes": {
    title: "Avaliações",
    subtitle: "Reputação do seu atendimento",
    steps: [
      { title: "Monte o formulário", description: "Escolha as perguntas e as notas que o cliente vai responder após a visita." },
      { title: "Divulgue o QR", description: "Coloque o QR na mesa ou no balcão para coletar avaliações no fim do atendimento." },
      { title: "Responda", description: "Responda cada avaliação pelo painel — o cliente recebe a resposta e sente que foi ouvido." },
    ],
  },
  "/app/qrcodes": {
    title: "QR Codes",
    subtitle: "Todos os seus códigos em um lugar",
    steps: [
      { title: "Escolha o destino", description: "Cada QR pode apontar para avaliação, Bio Commerce, cardápio, catálogo ou cartão fidelidade." },
      { title: "Crie etiquetas", description: "Gere QRs diferentes por mesa, balcão ou campanha para saber de onde vem cada acesso." },
      { title: "Acompanhe os scans", description: "As leituras aparecem em Analytics, separadas por etiqueta." },
    ],
  },
  "/app/catalogo": {
    title: "Catálogo digital",
    subtitle: "Sua vitrine de produtos e serviços",
    steps: [
      { title: "Comece por um modelo", description: "Escolha um modelo pronto do seu segmento — já vem com coleções e produtos de exemplo." },
      { title: "Cadastre produtos", description: "Fotos, preço, variações e estoque. Sem estoque, o item some da vitrine automaticamente." },
      { title: "Aparência", description: "No editor por etapas você define layout, cores e vê a prévia ao vivo no celular." },
      { title: "Publique e venda", description: "Ao publicar, o cliente monta o carrinho e envia o pedido direto no seu WhatsApp." },
    ],
  },
  "/app/pedidos": {
    title: "Pedidos",
    subtitle: "Acompanhe o que chega do catálogo",
    steps: [
      { title: "Novos pedidos", description: "Cada carrinho enviado pelo cliente vira um pedido aqui, com itens e valor total." },
      { title: "Mude o status", description: "Confirme, prepare e finalize — o histórico fica registrado para consulta." },
      { title: "Fale com o cliente", description: "Abra a conversa no WhatsApp direto pelo pedido para combinar entrega ou retirada." },
    ],
  },
  "/app/wallet": {
    title: "Carteira digital",
    subtitle: "Apple Wallet e Google Wallet",
    steps: [
      { title: "Personalize o cartão", description: "Escolha textura, cores e logo — a prévia mostra exatamente como o cliente vai ver." },
      { title: "Ative os passes", description: "Com a carteira ligada, o cliente adiciona o cartão ao celular em um toque." },
      { title: "Atualização automática", description: "Cada carimbo novo sincroniza no passe do cliente, sem ele precisar abrir o app." },
    ],
  },
  "/app/perfil": {
    title: "Perfil do estabelecimento",
    subtitle: "Como seu negócio aparece",
    steps: [
      { title: "Dados do negócio", description: "Nome, logo, endereço e contato — é o que o cliente vê nas páginas públicas." },
      { title: "Endereço público", description: "Confira o seu link (/e/seu-slug); ele é usado no QR, na carteira e na aba Descobrir." },
      { title: "Redes e horários", description: "Preencha redes sociais e funcionamento para aumentar a confiança de quem chega pelo QR." },
    ],
  },
  "/app/qr": {

    title: "QR Codes e materiais",
    subtitle: "Divulgação pronta para imprimir",
    steps: [
      { title: "Escolha o destino", description: "Defina se o QR leva para a avaliação, a Bio Commerce, o cardápio ou o cartão fidelidade." },
      { title: "Personalize a arte", description: "Suba sua logo e escolha o modelo: story, feed, A5, A4 ou display de mesa 7x10cm." },
      { title: "Baixe e imprima", description: "Exporte em alta resolução com margem de segurança para gráfica." },
    ],
  },
  "/app/linktree": {
    title: "Bio Commerce",
    subtitle: "Sua bio-link própria",
    steps: [
      { title: "Adicione os links", description: "Cardápio, WhatsApp, redes sociais, delivery — na ordem que fizer sentido." },
      { title: "Personalize a página", description: "Logo, cores e descrição do seu negócio deixam a página com a sua cara." },
      { title: "Divulgue e meça", description: "Use o link na bio e acompanhe os cliques em Analytics." },
    ],
  },
  "/app/cardapio": {
    title: "Cardápio virtual",
    subtitle: "Do zero ao QR na mesa",
    steps: [
      { title: "Crie o cardápio", description: "Defina nome, horário de funcionamento e capa do seu cardápio digital." },
      { title: "Categorias e pratos", description: "Monte as seções e cadastre pratos com foto, descrição e preço." },
      { title: "Publique", description: "Ao publicar, o cardápio fica no ar com link público e QR próprio para mesa e balcão." },
    ],
  },
  "/app/cardapio/categorias": {
    title: "Categorias do cardápio",
    subtitle: "Organize as seções",
    steps: [
      { title: "Crie as seções", description: "Entradas, pratos, bebidas, sobremesas — o que fizer sentido no seu menu." },
      { title: "Ordene", description: "Arraste para definir a ordem em que o cliente vê cada seção." },
      { title: "Ative ou pause", description: "Desative uma categoria inteira quando estiver fora do horário ou em falta." },
    ],
  },
  "/app/cardapio/pratos": {
    title: "Pratos",
    subtitle: "Itens do cardápio",
    steps: [
      { title: "Cadastre o item", description: "Nome, descrição, preço e categoria. Fotos boas vendem muito mais." },
      { title: "Destaques", description: "Marque os pratos que devem aparecer em evidência na página pública." },
      { title: "Disponibilidade", description: "Marque como esgotado quando faltar — some do cardápio sem precisar excluir." },
    ],
  },
  "/app/notificacoes": {
    title: "Notificações",
    subtitle: "Push para quem já é seu cliente",
    steps: [
      { title: "Escreva a mensagem", description: "Título curto e uma chamada clara. Pode agendar para o melhor horário." },
      { title: "Segmente", description: "Escolha o público (todos, inativos, nível) e veja a prévia com o número de destinatários." },
      { title: "Confirme o envio", description: "Após confirmar, acompanhe entregas e aberturas no histórico." },
    ],
  },
  "/app/promocoes": {
    title: "Promoções",
    subtitle: "Ofertas na vitrine pública",
    steps: [
      { title: "Crie a oferta", description: "Título, imagem e período de validade da promoção." },
      { title: "Publique", description: "A promoção aparece no seu perfil público e na aba Descobrir." },
      { title: "Acompanhe", description: "Veja visualizações e cliques para saber o que converte." },
    ],
  },
  "/app/mensagens": {
    title: "Mensagens",
    subtitle: "Recado direto para seus clientes",
    steps: [
      { title: "Publique um recado", description: "Uma mensagem por semana aparece para os clientes na carteira digital." },
      { title: "Seja objetivo", description: "Novidades, mudança de horário ou uma oferta relâmpago funcionam melhor." },
    ],
  },
  "/app/analytics": {
    title: "Analytics",
    subtitle: "Os números do seu negócio",
    steps: [
      { title: "Visão geral", description: "Carimbos, clientes novos, resgates e receita no período escolhido." },
      { title: "Canais", description: "Veja de onde vêm os acessos: QR, Bio Commerce, cardápio ou avaliações." },
      { title: "Exporte", description: "Baixe os dados em CSV ou PDF para analisar fora do sistema." },
    ],
  },
  "/app/equipe": {
    title: "Equipe",
    subtitle: "Quem pode fazer o quê",
    steps: [
      { title: "Convide", description: "Envie o convite por e-mail; a pessoa entra já vinculada ao seu estabelecimento." },
      { title: "Defina o papel", description: "Proprietário, gerente ou atendente — cada um com um nível de acesso." },
      { title: "Ajuste permissões", description: "Pode liberar ou bloquear funções específicas para cada membro." },
    ],
  },
  "/app/planos": {
    title: "Planos",
    subtitle: "Recursos e limites",
    steps: [
      { title: "Veja seu uso", description: "Acompanhe quanto já usou de clientes, carimbos e recursos do plano atual." },
      { title: "Compare planos", description: "Cada plano libera módulos como cardápio, avaliações e automações." },
      { title: "Faça upgrade", description: "A mudança é imediata após a confirmação do pagamento." },
    ],
  },
  "/app/pagamentos": {
    title: "Pagamentos",
    subtitle: "Assinatura e faturas",
    steps: [
      { title: "Histórico", description: "Todas as cobranças, com status e data." },
      { title: "Comprovantes", description: "Baixe o recibo de cada pagamento aprovado." },
    ],
  },
  "/app/kb": {
    title: "Central de Ajuda",
    subtitle: "Respostas rápidas",
    steps: [
      { title: "Busque", description: "Digite sua dúvida — são dezenas de artigos com passo a passo." },
      { title: "Não achou?", description: "Abra um chamado em Fale com a Fidelize e a gente responde." },
    ],
  },
  "/app/fidelize": {
    title: "Fale com a Fidelize",
    subtitle: "Suporte direto com a nossa equipe",
    steps: [
      { title: "Abra um chamado", description: "Descreva o problema e anexe uma imagem se ajudar." },
      { title: "Acompanhe", description: "Você recebe notificação quando respondermos." },
    ],
  },
};

/** Casa o pathname atual com o guia mais específico disponível. */
/** Módulo do painel (ex.: /app/cardapio/pratos -> /app/cardapio). */
export function moduleOf(pathname: string): string {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return `/${parts.slice(0, 2).join("/")}`;
}

export function findPageGuide(pathname: string): { path: string; module: string; guide: PageGuide } | null {
  const clean = pathname.replace(/\/+$/, "") || "/app";
  if (PAGE_GUIDES[clean]) return { path: clean, module: moduleOf(clean), guide: PAGE_GUIDES[clean] };
  const match = Object.keys(PAGE_GUIDES)
    .filter((p) => clean.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? { path: match, module: moduleOf(clean), guide: PAGE_GUIDES[match] } : null;
}

/**
 * Telas em que o passo a passo é oferecido automaticamente na primeira visita.
 * Nas demais, o guia existe mas só abre quando o lojista clica no botão de ajuda.
 */
export const AUTO_GUIDE_MODULES = new Set<string>([
  // Auto-popup APENAS no Dashboard (que usa GuidedTour separado).
  // Nos demais módulos o guia existe, mas só é aberto quando o lojista clica
  // no ícone "?" pulsante do cabeçalho — evita empilhar popups a cada rota.
]);

const GUIDE_KEY_PREFIX = "fidelize_page_guide_v1";

export function guideStorageKey(scope: string, module: string) {
  return `${GUIDE_KEY_PREFIX}:${scope}:${module}`;
}

export function isGuideSeen(scope: string, module: string) {
  if (typeof window === "undefined") return true;
  try { return !!window.localStorage.getItem(guideStorageKey(scope, module)); } catch { return true; }
}

export function markGuideSeen(scope: string, module: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(guideStorageKey(scope, module), "seen"); } catch { /* noop */ }
}

/** Evento global: abre o passo a passo da tela atual. */
export const OPEN_PAGE_GUIDE_EVENT = "fidelize:open-page-guide";

export function openPageGuide() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_PAGE_GUIDE_EVENT));
}
