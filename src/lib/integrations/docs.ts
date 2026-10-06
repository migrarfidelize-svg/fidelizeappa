/**
 * Guia passo a passo por provedor. Renderizado na aba "Como configurar"
 * do card de cada integração em /hash/integracoes.
 */
export type ProviderGuide = {
  intro: string;
  prerequisites?: string[];
  steps: { title: string; description: string; url?: string }[];
  troubleshooting?: { symptom: string; fix: string }[];
};

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  // ---------- Pagamentos ----------
  mercadopago: {
    intro:
      "Integração oficial com o Mercado Pago (PIX, Cartão, Boleto). Também suporta assinaturas via preapproval.",
    prerequisites: ["Conta Mercado Pago verificada", "Aplicação criada em Developers"],
    steps: [
      { title: "Criar aplicação", description: "Acesse Developers → Suas integrações → Criar aplicação.", url: "https://www.mercadopago.com.br/developers/panel/app" },
      { title: "Copiar Access Token (produção)", description: "Em Credenciais de produção copie o Access Token." },
      { title: "Copiar Public Key", description: "Na mesma tela copie a Public Key usada no checkout." },
      { title: "Preencher no painel", description: "Cole Access Token e Public Key nos campos abaixo e clique em Salvar." },
      { title: "Cadastrar Webhook", description: "Em Notificações → Webhooks, cole a URL 'Notificações unificadas' da aba Webhooks.", url: "https://www.mercadopago.com.br/developers/panel/webhooks" },
      { title: "Ativar HMAC", description: "Gere o Signing secret e salve no campo Webhook Secret (HMAC)." },
      { title: "Ambiente", description: "Selecione Produção para credenciais reais ou Sandbox para TESTUSER." },
      { title: "Testar conexão", description: "Clique em Testar conexão e confirme Conectado como <sua conta>." },
    ],
    troubleshooting: [
      { symptom: "401 Unauthorized use of live credentials", fix: "O pagador está usando o mesmo e-mail da conta que recebe. Use outra conta para testar." },
      { symptom: "Credencial TESTUSER em Produção", fix: "Troque para o Access Token real ou mude o ambiente para Sandbox." },
    ],
  },

  stripe: {
    intro: "Stripe Payments para cartão internacional e assinaturas.",
    steps: [
      { title: "Criar conta", description: "Cadastre-se em https://dashboard.stripe.com e ative a conta." },
      { title: "Copiar Secret Key", description: "Developers → API keys → Reveal Secret key (sk_live_...)." },
      { title: "Copiar Publishable Key", description: "Copie a chave pk_live_... na mesma tela." },
      { title: "Preencher no painel", description: "Salve Secret Key e Publishable Key nos campos." },
      { title: "Webhook", description: "Developers → Webhooks → Add endpoint com a URL da aba Webhooks." },
      { title: "Copiar Signing secret", description: "Após criar, copie o whsec_... e salve em Webhook Secret." },
      { title: "Testar conexão", description: "Use Testar conexão para validar a chamada /v1/balance." },
    ],
  },

  asaas: {
    intro: "Asaas (BR) — PIX, boleto, cartão e cobranças recorrentes.",
    steps: [
      { title: "Criar conta", description: "Cadastre-se em https://www.asaas.com." },
      { title: "Gerar API Key", description: "Perfil → Integrações → Gerar chave de API (Produção ou Sandbox)." },
      { title: "Preencher", description: "Cole a API Key e escolha o ambiente (sandbox/produção)." },
      { title: "Webhook", description: "Integrações → Webhooks: cole a URL 'Notificações Asaas' e configure o token." },
      { title: "Testar", description: "Clique em Testar conexão." },
    ],
  },

  pagseguro: {
    intro: "PagBank / PagSeguro — cobranças e checkout transparente.",
    steps: [
      { title: "Criar aplicação", description: "Portal do desenvolvedor → Aplicações." },
      { title: "Copiar Token", description: "Gere o token de produção." },
      { title: "Preencher", description: "Cole o token no campo abaixo e selecione o ambiente." },
      { title: "Webhook", description: "Cadastre a URL da aba Webhooks nas notificações." },
      { title: "Testar", description: "Use Testar conexão." },
    ],
  },

  pagarme: {
    intro: "Pagar.me — cartão, PIX e assinaturas.",
    steps: [
      { title: "Criar conta", description: "https://pagar.me e ative a conta." },
      { title: "Copiar API Key", description: "Dashboard → Configurações → Chaves. Use a chave secreta (sk_)." },
      { title: "Preencher", description: "Salve a chave no campo API Key." },
      { title: "Webhook", description: "Configurações → Webhooks e cole a URL da aba Webhooks." },
      { title: "Testar", description: "Use Testar conexão." },
    ],
  },

  // ---------- IA ----------
  openai: {
    intro: "OpenAI Platform — GPT, embeddings e imagens.",
    steps: [
      { title: "Criar conta", description: "https://platform.openai.com." },
      { title: "Gerar API Key", description: "API keys → Create new secret key." },
      { title: "(Opcional) Organization", description: "Se sua conta tem múltiplas orgs, informe o org_id." },
      { title: "Preencher", description: "Salve a API Key e o modelo padrão desejado." },
      { title: "Testar", description: "Testar conexão chama /v1/models." },
    ],
  },
  gemini: {
    intro: "Google Generative AI (Gemini).",
    steps: [
      { title: "Acessar AI Studio", description: "https://aistudio.google.com/app/apikey." },
      { title: "Gerar API Key", description: "Create API key e copie o valor." },
      { title: "Preencher", description: "Salve a API Key e o modelo (ex.: gemini-1.5-flash)." },
      { title: "Testar", description: "Testar conexão faz uma chamada leve ao endpoint models." },
    ],
  },
  claude: {
    intro: "Anthropic Claude.",
    steps: [
      { title: "Console Anthropic", description: "https://console.anthropic.com." },
      { title: "API Keys", description: "Settings → API Keys → Create key." },
      { title: "Preencher", description: "Salve a API Key (sk-ant-...) e o modelo padrão." },
      { title: "Testar", description: "Testar conexão." },
    ],
  },
  grok: {
    intro: "xAI Grok.",
    steps: [
      { title: "Console xAI", description: "https://console.x.ai." },
      { title: "Gerar API Key", description: "API Keys → Create." },
      { title: "Preencher e testar", description: "Salve a chave e clique em Testar conexão." },
    ],
  },
  deepseek: {
    intro: "DeepSeek Platform.",
    steps: [
      { title: "Cadastro", description: "https://platform.deepseek.com." },
      { title: "API Keys", description: "Crie uma nova chave." },
      { title: "Preencher e testar", description: "Salve a chave e teste." },
    ],
  },
  openrouter: {
    intro: "OpenRouter — proxy multi-modelo.",
    steps: [
      { title: "Cadastro", description: "https://openrouter.ai." },
      { title: "Gerar chave", description: "Keys → Create Key." },
      { title: "Modelo padrão", description: "Escolha ex.: openrouter/auto ou anthropic/claude-3.5-sonnet." },
      { title: "Testar", description: "Testar conexão." },
    ],
  },

  // ---------- Marketing ----------
  meta_pixel: {
    intro:
      "Rastreamento do Meta (Facebook/Instagram): o Pixel roda no navegador nas páginas públicas e a Conversions API envia eventos server-side, resistentes a bloqueadores e ao fim dos cookies de terceiros.",
    prerequisites: [
      "Conta no Gerenciador de Negócios (business.facebook.com)",
      "Um Pixel criado no Events Manager",
      "Permissão de administrador no conjunto de dados",
    ],
    steps: [
      {
        title: "Abrir o Events Manager",
        description: "Acesse Gerenciador de Eventos → Fontes de dados e selecione (ou crie) o seu Pixel.",
        url: "https://business.facebook.com/events_manager2",
      },
      {
        title: "Copiar o Pixel ID",
        description: "No topo da página aparece o ID do conjunto de dados — uma sequência só de números. Cole no campo Pixel ID, na aba Configuração.",
      },
      {
        title: "Gerar o token da Conversions API",
        description:
          "No Pixel, abra Configurações → Conversions API → Gerar token de acesso. Copie o token (ele só é exibido uma vez).",
      },
      {
        title: "Salvar o token com segurança",
        description:
          "Cole o token na aba Credenciais e clique em Salvar. Ele é gravado apenas no backend — nunca é devolvido ao navegador nem aparece no código do site.",
      },
      {
        title: "Código de teste (recomendado)",
        description:
          "Em Testar eventos, copie o código TESTxxxxx e cole no campo Código de teste. Com ele preenchido, o botão Testar envia um PageView real que aparece na tela em segundos.",
      },
      {
        title: "Testar conexão",
        description:
          "Clique em Testar. O sistema lê o conjunto de dados na Graph API para validar token + Pixel e, se houver código de teste, dispara o evento de validação.",
      },
      {
        title: "Ativar",
        description:
          "Ligue a chave da integração. Com Rastrear páginas públicas em Sim, o Pixel passa a carregar apenas nas páginas públicas (landing, perfil da loja, cardápio, Bio Commerce) — nunca no painel autenticado.",
      },
    ],
    troubleshooting: [
      {
        symptom: "OAuthException (190): Invalid OAuth access token",
        fix: "O token expirou ou foi revogado. Gere um novo em Conversions API → Gerar token de acesso e salve novamente.",
      },
      {
        symptom: "(#100) Unsupported get request / Object does not exist",
        fix: "O Pixel ID está errado ou o token pertence a outro Gerenciador de Negócios. Confirme o ID do conjunto de dados e o negócio dono do token.",
      },
      {
        symptom: "(#200) Permissões insuficientes",
        fix: "O usuário que gerou o token não é administrador do conjunto de dados. Peça o acesso no Gerenciador de Negócios e gere o token de novo.",
      },
      {
        symptom: "Teste passa, mas nada aparece no Events Manager",
        fix: "Sem o código de teste os eventos vão para o fluxo normal e levam alguns minutos. Preencha o Código de teste para ver em tempo real.",
      },
    ],
  },
};


export function getGuide(providerId: string): ProviderGuide | null {
  return PROVIDER_GUIDES[providerId] ?? null;
}
