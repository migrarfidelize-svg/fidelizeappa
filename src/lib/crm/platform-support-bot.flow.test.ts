import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeFlow } from "./flow-engine.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWhatsAppProvider } from "../otp.functions";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("../otp.functions", () => ({ getActiveWhatsAppProvider: vi.fn() }));
const send = vi.fn();
const data: Record<string, any[]> = {};

class Query {
  private op = "select";
  private value: any;
  private filters: Array<[string, any]> = [];
  constructor(private table: string) {}
  select() { return this; }
  eq(key: string, val: any) { this.filters.push([key, val]); return this; }
  is(key: string, val: any) { this.filters.push([key, val]); return this; }
  in(key: string, vals: any[]) { this.filters.push([key, vals]); return this; }
  limit() { return this; }
  order() { return this; }
  insert(value: any) { this.op = "insert"; this.value = value; return this; }
  update(value: any) { this.op = "update"; this.value = value; return this; }
  upsert(value: any) { this.op = "upsert"; this.value = value; return this; }
  private rows() {
    return (data[this.table] || []).filter((row) => this.filters.every(([key, val]) =>
      Array.isArray(val) ? val.includes(row[key]) : row[key] === val,
    ));
  }
  private result() {
    const collection = data[this.table] ||= [];
    if (this.op === "insert") {
      const entry = { id: this.table + "-" + (collection.length + 1), ...this.value };
      collection.push(entry);
      return { data: [entry], error: null };
    }
    if (this.op === "upsert") {
      if (!collection.some((row) => row.conversation_id === this.value.conversation_id &&
        row.tag_id === this.value.tag_id)) collection.push(this.value);
      return { data: [this.value], error: null };
    }
    const rows = this.rows();
    if (this.op === "update") rows.forEach((row) => Object.assign(row, this.value));
    return { data: rows, error: null };
  }
  single() { const r = this.result(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }); }
  maybeSingle() { const r = this.result(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }); }
  then(cb: any) { return Promise.resolve(this.result()).then(cb); }
}

describe("WhatsApp Fidelize — bot institucional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(data)) delete data[key];
    data.establishments = [{ id: "plat", slug: "admin", name: "Fidelize" }];
    data.crm_agent_settings = [{ establishment_id: "plat", enabled: true, config: { supportMode: "bot" } }];
    data.crm_conversations = [{ id: "conv", establishment_id: "plat", customer_phone: "5511999999999", status: "bot", bot_paused: false, metadata: {} }];
    data.crm_messages = [];
    data.crm_support_tickets = [];
    data.crm_tags = [];
    data.crm_queues = [];
    data.crm_conversation_tags = [];
    data.plans = [
      { name: "Essencial", price_monthly: 29.9, price_yearly: 299.9, currency: "BRL", is_active: true, archived_at: null },
      { name: "Oculto", price_monthly: 999, is_active: false, archived_at: null },
    ];
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => new Query(table) as any);
    send.mockResolvedValue({ ok: true, providerMessageId: "test-" + Math.random() });
    vi.mocked(getActiveWhatsAppProvider).mockResolvedValue({
      establishmentId: "plat", runtime: {},
      provider: { meta: { id: "uazapi" }, sendTestMessage: send },
    } as any);
  });

  it("primeiro contato recebe 3 botões, sem IA", async () => {
    const result = await executeFlow("conv", "oi");
    expect(result.action).toBe("platform_menu");
    const opts = send.mock.calls[0][4];
    expect(opts.type).toBe("options");
    expect(opts.nativeButtonsOnly).toBe(true);
    expect(opts.options.map((item: any) => item.label)).toEqual(["Suporte", "Planos", "Sugestões"]);
    expect(data.crm_messages).toHaveLength(1);
  });

  it("Suporte coloca em fila com tags, ticket e pausa do bot", async () => {
    await executeFlow("conv", "fidelize_support");
    expect(data.crm_conversations[0]).toMatchObject({ status: "waiting", bot_paused: true });
    expect(data.crm_queues).toHaveLength(1);
    expect(data.crm_support_tickets).toHaveLength(1);
    expect(data.crm_tags.map((item: any) => item.name)).toEqual(["Suporte", "Aguardando atendimento"]);
    expect(data.crm_conversation_tags).toHaveLength(2);
    expect(data.crm_messages[0].body).toMatch(/na fila de suporte/i);
    expect(send.mock.calls[1][4]).toMatchObject({
      type: "options", nativeButtonsOnly: true,
      options: [{ label: "Voltar ao menu", value: "fidelize_menu" }],
    });
    const count = data.crm_messages.length;
    expect((await executeFlow("conv", "oi")).action).toBe("ignored");
    expect(data.crm_messages).toHaveLength(count);
  });

  it("Voltar ao menu retoma bot quando suporte ainda está na fila sem atendente", async () => {
    await executeFlow("conv", "fidelize_support");
    const r = await executeFlow("conv", "fidelize_menu");
    expect(r.action).toBe("platform_menu");
    expect(data.crm_conversations[0]).toMatchObject({
      status: "bot", bot_paused: false, metadata: { support: { active: false } },
    });
    expect(data.crm_support_tickets[0].status).toBe("resolved");
    expect(send.mock.calls.at(-1)?.[4].options.map((x: any) => x.label))
      .toEqual(["Suporte", "Planos", "Sugestões"]);
  });

  it("Voltar ao menu em texto desbloqueia fila sem atendente", async () => {
    await executeFlow("conv", "fidelize_support");
    const r = await executeFlow("conv", "Voltar ao menu");
    expect(r.action).toBe("platform_menu");
    expect(data.crm_conversations[0].status).toBe("bot");
    expect(data.crm_conversations[0].metadata.support.active).toBe(false);
    expect(data.crm_support_tickets[0].status).toBe("resolved");
  });

  it("Voltar ao menu não interrompe atendimento já atribuído a humano", async () => {
    await executeFlow("conv", "fidelize_support");
    data.crm_conversations[0].assigned_to = "human-1";
    const sends = send.mock.calls.length;
    expect((await executeFlow("conv", "fidelize_menu")).action).toBe("ignored");
    expect(data.crm_conversations[0].status).toBe("waiting");
    expect(data.crm_support_tickets[0].status).toBe("open");
    expect(send.mock.calls).toHaveLength(sends);
  });

  it("Planos envia card com link nativo por plano e botão separado para voltar", async () => {
    const r = await executeFlow("conv", "fidelize_plans");
    expect(r.action).toBe("plans_sent");
    expect(data.crm_messages[0].body).toContain("Essencial");
    expect(data.crm_messages.some((item: any) => item.body.includes("Oculto"))).toBe(false);
    expect(send.mock.calls).toHaveLength(2);
    expect(send.mock.calls[0][4]).toMatchObject({
      type: "options", nativeButtonsOnly: true,
      options: [{ label: "Conhecer plano", value: "https://afidelize.app/?plano=essencial#precos" }],
    });
    expect(send.mock.calls[1][4]).toMatchObject({
      type: "options", nativeButtonsOnly: true,
      options: [{ label: "Voltar ao menu", value: "fidelize_menu" }],
    });
    expect(data.crm_support_tickets).toHaveLength(0);
    expect((await executeFlow("conv", "fidelize_menu")).action).toBe("platform_menu");
  });

  it("Sugestões registra no histórico e etiqueta sem abrir fila", async () => {
    expect((await executeFlow("conv", "fidelize_suggestions")).action).toBe("suggestion_requested");
    expect((await executeFlow("conv", "Queria uma função nova")).action).toBe("suggestion_recorded");
    expect(data.crm_tags.map((tag: any) => tag.name)).toContain("Sugestões");
    expect(data.crm_conversations[0].status).toBe("bot");
    expect(data.crm_support_tickets).toHaveLength(0);
  });
});
