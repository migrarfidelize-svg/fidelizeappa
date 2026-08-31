/** Documentação OpenAPI 3.1 da API REST privada de integrações. */
import { API_BASE_PATH } from "./rest-api.server";

const customerSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    code: { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
    email: { type: "string", nullable: true },
    tier: { type: "string", enum: ["bronze", "prata", "ouro", "diamante"] },
    visits: { type: "integer" },
    last_visit_at: { type: "string", format: "date-time", nullable: true },
    marketing_opt_in: { type: "boolean" },
    birthdate: { type: "string", nullable: true },
    notes: { type: "string", nullable: true },
    blocked: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    establishment_id: { type: "string", format: "uuid" },
  },
} as const;

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
} as const;

const pointsBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          customer_id: { type: "string", format: "uuid", description: "Obrigatório se phone não for enviado." },
          phone: { type: "string", description: "Alternativa ao customer_id." },
          quantity: { type: "integer", minimum: 1, maximum: 50, default: 1 },
          campaign_id: { type: "string", format: "uuid", description: "Opcional: campanha específica. Padrão: campanha ativa." },
        },
      },
    },
  },
} as const;

const commonResponses = {
  "401": { description: "API Key ausente, inválida ou revogada", content: { "application/json": { schema: errorSchema } } },
  "403": { description: "Origem não autorizada", content: { "application/json": { schema: errorSchema } } },
  "429": { description: "Limite de requisições por minuto excedido", content: { "application/json": { schema: errorSchema } } },
} as const;

export function buildOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Fidelize — API de Integrações",
      version: "2.4.0",
      description:
        "API REST privada para integração externa com o Fidelize. Exceto `/health` e a documentação, todas as rotas exigem API Key no cabeçalho `x-api-key` (ou `Authorization: Bearer`).\n\n**Escopos por chave:** `customers.read`, `customers.write`, `points.manage`, `stats.read`, `provisioning`. Cada endpoint valida o escopo necessário e responde 403 (`scope_required`) quando ausente.\n\n**Tipo da chave:** `browser` valida `Origin`/`Referer` contra a lista de origens permitidas; `server` (server-to-server) ignora a validação de origem e autentica apenas por API Key, escopos e limite de requisições.\n\n**Sandbox:** chaves marcadas como sandbox leem dados reais, mas nenhuma escrita é persistida — as respostas trazem `\"sandbox\": true`.\n\nCada chave é vinculada a um estabelecimento, possui limite de requisições por minuto, tipo (`browser` ou `server`), lista opcional de origens permitidas (apenas para chaves `browser`) e registra logs imutáveis de auditoria (endpoint, método, IP, origem, status, tempo de resposta e chave utilizada).",
    },
    servers: [{ url: `${origin}${API_BASE_PATH}` }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
      },
      schemas: { Customer: customerSchema, Error: errorSchema },
    },
    paths: {
      "/health": {
        get: {
          summary: "Saúde da API (público, não exige API Key)",
          security: [],
          responses: {
            "200": {
              description: "API operacional",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      version: { type: "string" },
                      uptime: { type: "string" },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/ping-auth": {
        get: {
          summary: "Valida a autenticação da API Key",
          description:
            "Permite que sistemas externos confirmem que a chave é válida e conheçam seus escopos, sem chamar endpoints de negócio. Retorna 401 quando a chave é inválida ou revogada e 429 quando o rate limit é excedido.",
          responses: {
            "200": {
              description: "Autenticação válida",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      authenticated: { type: "boolean", example: true },
                      api_key_valid: { type: "boolean", example: true },
                      scopes: { type: "array", items: { type: "string" }, example: ["customers.read", "provisioning"] },
                      sandbox: { type: "boolean" },
                      key_type: { type: "string", enum: ["browser", "server"] },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            ...commonResponses,
          },
        },
      },
      "/magic-link": {
        post: {
          summary: "Gera link de login automático (SSO)",
          description:
            "Requer escopo `provisioning`. Devolve uma URL de autologin de uso único, válida por 5 minutos, vinculada ao usuário e ao tenant. Após o uso o token é invalidado imediatamente.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email", example: "dono@empresa.com" },
                    source: { type: "string", example: "ronnei" },
                  },
                },
                example: { email: "dono@empresa.com", source: "ronnei" },
              },
            },
          },
          responses: {
            "200": {
              description: "Link gerado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      email: { type: "string" },
                      user_id: { type: "string", format: "uuid" },
                      magic_link: { type: "string", format: "uri" },
                      autologin_url: { type: "string", format: "uri" },
                      autologin_token: { type: "string" },
                      expires_at: { type: "string", format: "date-time" },
                      expires_in: { type: "integer", example: 300 },
                    },
                  },
                  example: {
                    success: true,
                    email: "dono@empresa.com",
                    user_id: "7c9e...",
                    magic_link: "https://afidelize.app/auth/autologin?token=abc123",
                    autologin_url: "https://afidelize.app/auth/autologin?token=abc123",
                    autologin_token: "abc123",
                    expires_in: 300,
                  },
                },
              },
            },
            ...commonResponses,
          },
        },
      },
      "/password-reset": {

        post: {
          summary: "Envia o e-mail de redefinição de senha",
          description:
            "Requer escopo `provisioning`. Dispara o e-mail personalizado da Fidelize com o link seguro de redefinição de senha. A resposta é sempre neutra: não revela se o e-mail existe.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email", example: "dono@empresa.com" },
                    redirect_to: {
                      type: "string",
                      description: "URL de retorno após clicar no link. Padrão: /auth/nova-senha do próprio domínio.",
                      example: "https://afidelize.app/auth/nova-senha",
                    },
                  },
                },
                example: { email: "dono@empresa.com" },
              },
            },
          },
          responses: {
            "200": {
              description: "Solicitação registrada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      email: { type: "string", example: "dono@empresa.com" },
                      message: { type: "string" },
                      sandbox: { type: "boolean" },
                    },
                  },
                  example: {
                    success: true,
                    email: "dono@empresa.com",
                    message: "Se o e-mail existir, o link de redefinição foi enviado.",
                  },
                },
              },
            },
            ...commonResponses,
          },
        },
      },
      "/change-plan": {
        post: {
          summary: "Altera o plano de um tenant",
          description: "Requer escopo `provisioning`. Reativa os módulos do plano e renova o período por 30 dias.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tenant_id", "plan"],
                  properties: {
                    tenant_id: { type: "string", format: "uuid" },
                    plan: { type: "string", enum: ["starter", "pro", "premium"] },
                  },
                },
                example: { tenant_id: "1f2e...", plan: "pro" },
              },
            },
          },
          responses: {
            "200": {
              description: "Plano alterado",
              content: {
                "application/json": {
                  example: { success: true, tenant_id: "1f2e...", plan: "pro", tier: "pro", modules: ["loyalty_card", "digital_menu", "linktree"], status: "active" },
                },
              },
            },
            "404": { description: "Tenant não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/suspend-account": {
        post: {
          summary: "Suspende uma conta",
          description: "Requer escopo `provisioning`. Desativa o tenant e cancela a assinatura ativa.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tenant_id"],
                  properties: {
                    tenant_id: { type: "string", format: "uuid" },
                    reason: { type: "string", maxLength: 200 },
                  },
                },
                example: { tenant_id: "1f2e...", reason: "inadimplência" },
              },
            },
          },
          responses: {
            "200": {
              description: "Conta suspensa",
              content: { "application/json": { example: { success: true, tenant_id: "1f2e...", status: "suspended", reason: "inadimplência" } } },
            },
            "404": { description: "Tenant não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/reactivate-account": {
        post: {
          summary: "Reativa uma conta suspensa",
          description: "Requer escopo `provisioning`. Reativa o tenant e a assinatura mais recente por mais 30 dias.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["tenant_id"], properties: { tenant_id: { type: "string", format: "uuid" } } },
                example: { tenant_id: "1f2e..." },
              },
            },
          },
          responses: {
            "200": {
              description: "Conta reativada",
              content: { "application/json": { example: { success: true, tenant_id: "1f2e...", status: "active" } } },
            },
            "404": { description: "Tenant não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/provisioning/{tenantId}": {
        get: {
          summary: "Consulta uma conta provisionada",
          description: "Retorna tenant, plano, módulos liberados, usuário administrador e status. Requer escopo `provisioning`.",
          parameters: [{ name: "tenantId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "Conta encontrada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tenant: { type: "object" },
                      plan: { type: "object", nullable: true },
                      modules: { type: "array", items: { type: "string" } },
                      admin_user: { type: "object", nullable: true },
                      status: { type: "string", enum: ["active", "pending", "inactive"] },
                    },
                  },
                },
              },
            },
            "404": { description: "Tenant não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/provisioning/{tenantId}/resend-access": {
        post: {
          summary: "Reenvia o acesso do administrador (nova senha temporária)",
          description: "Gera uma nova senha temporária, envia e-mail de acesso e registra auditoria. Requer escopo `provisioning`.",
          parameters: [{ name: "tenantId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "Acesso reenviado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      tenant_id: { type: "string", format: "uuid" },
                      user_id: { type: "string", format: "uuid" },
                      email: { type: "string" },
                      temporary_password: { type: "string" },
                      login_url: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
            "404": { description: "Tenant ou administrador não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/provision-account": {
        post: {
          summary: "Provisiona uma conta completa (empresa + admin + plano + módulos)",
          description:
            "Cria a empresa (tenant), o usuário administrador com senha temporária, ativa a assinatura do plano informado e libera os módulos Cartão Fidelidade, Cardápio Digital e Árvore de Links. Requer API Key com escopo `provisioning`.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "plan"],
                  properties: {
                    name: { type: "string", maxLength: 80 },
                    email: { type: "string", format: "email" },
                    phone: { type: "string" },
                    plan: { type: "string", enum: ["starter", "pro", "premium"] },
                    source: { type: "string", description: "Origem do provisionamento (ex.: ronnei)." },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Conta provisionada",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      tenant_id: { type: "string", format: "uuid" },
                      user_id: { type: "string", format: "uuid" },
                      temporary_password: { type: "string" },
                      login_url: { type: "string", format: "uri" },
                      autologin_url: {
                        type: "string",
                        format: "uri",
                        description: "Login automático (SSO): uso único, expira em 5 minutos.",
                      },
                      autologin_token: { type: "string" },
                      autologin_expires_at: { type: "string", format: "date-time" },
                      autologin_expires_in: { type: "integer", example: 300 },

                      slug: { type: "string" },
                      plan: { type: "string" },
                      modules: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
            "409": { description: "E-mail já em uso ou plano indisponível", content: { "application/json": { schema: errorSchema } } },
            "422": { description: "Dados inválidos", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/customer/{id}": {
        get: {
          summary: "Retorna dados completos do cliente",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Cliente encontrado", content: { "application/json": { schema: { type: "object", properties: { customer: customerSchema } } } } },
            "404": { description: "Cliente não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
        put: {
          summary: "Atualiza um cliente",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    notes: { type: "string" },
                    birthdate: { type: "string" },
                    marketing_opt_in: { type: "boolean" },
                    blocked: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Cliente atualizado", content: { "application/json": { schema: { type: "object", properties: { customer: customerSchema } } } } },
            "422": { description: "Dados inválidos", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/customer/{id}/stats": {
        get: {
          summary: "Estatísticas do cliente",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "Estatísticas",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      customer_id: { type: "string", format: "uuid" },
                      total_purchases: { type: "integer", description: "Total de compras registradas (pontos válidos acumulados no histórico)." },
                      points: { type: "integer", description: "Pontos atuais no cartão da campanha ativa." },
                      visits: { type: "integer" },
                      cashback: { type: "number", description: "Reservado: sempre 0 enquanto o módulo de cashback não estiver ativo." },
                      rewards: { type: "integer" },
                      tier: { type: "string" },
                      last_purchase_at: { type: "string", format: "date-time", nullable: true },
                    },
                  },
                },
              },
            },
            ...commonResponses,
          },
        },
      },
      "/customer-by-phone/{phone}": {
        get: {
          summary: "Busca cliente pelo telefone",
          parameters: [{ name: "phone", in: "path", required: true, schema: { type: "string" }, example: "11999998888" }],
          responses: {
            "200": { description: "Cliente encontrado", content: { "application/json": { schema: { type: "object", properties: { customer: customerSchema } } } } },
            "404": { description: "Cliente não encontrado", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/customer": {
        post: {
          summary: "Cria cliente (idempotente por telefone)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "phone"],
                  properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    notes: { type: "string" },
                    birthdate: { type: "string" },
                    marketing_opt_in: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Cliente criado", content: { "application/json": { schema: { type: "object", properties: { customer: customerSchema, created: { type: "boolean" } } } } } },
            "200": { description: "Cliente já existente com este telefone" },
            "422": { description: "Dados inválidos", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/points/add": {
        post: {
          summary: "Adiciona pontos (selos da campanha ativa)",
          requestBody: pointsBody,
          responses: {
            "200": {
              description: "Pontos adicionados",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      card_id: { type: "string", format: "uuid" },
                      points: { type: "integer" },
                      required: { type: "integer" },
                      cycle: { type: "integer" },
                      rewards_created: { type: "integer" },
                    },
                  },
                },
              },
            },
            "409": { description: "Sem campanha ativa", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
      "/points/remove": {
        post: {
          summary: "Remove pontos (estorna selos)",
          requestBody: pointsBody,
          responses: {
            "200": {
              description: "Pontos removidos",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      card_id: { type: "string", format: "uuid" },
                      removed: { type: "integer" },
                      points: { type: "integer" },
                      required: { type: "integer" },
                    },
                  },
                },
              },
            },
            "409": { description: "Sem pontos ou sem campanha ativa", content: { "application/json": { schema: errorSchema } } },
            ...commonResponses,
          },
        },
      },
    },
  };
}

export function swaggerHtml(origin: string): string {
  const specUrl = `${origin}${API_BASE_PATH}/openapi.json`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fidelize — API de Integrações</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
</head>
<body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
<script>
  window.addEventListener('load', function () {
    window.SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: '#swagger', docExpansion: 'list' });
  });
</script>
</body>
</html>`;
}
