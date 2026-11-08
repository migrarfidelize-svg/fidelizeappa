import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, BrainCircuit, Check, Headphones, RotateCcw, Send, Lightbulb, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listActivePlans } from "@/lib/plans.functions";
import {
  PLATFORM_SUPPORT_OPTIONS, SUPPORT_MENU_TEXT, SUPPORT_QUEUE_TEXT,
  SUPPORT_SUGGESTION_RECEIVED, SUPPORT_SUGGESTION_REQUEST,
  type SupportMode,
} from "@/lib/crm/platform-support-bot.core";

type Preview = "menu" | "support" | "plans" | "suggestions" | "sent";

export function SupportModePanel({
  mode, canManage, saving, onChange,
}: {
  mode: SupportMode;
  canManage: boolean;
  saving: boolean;
  onChange: (mode: SupportMode) => void;
}) {
  const [preview, setPreview] = useState<Preview>("menu");
  const [suggestion, setSuggestion] = useState("");
  const fetchPlans = useServerFn(listActivePlans);
  const plans = useQuery({
    queryKey: ["fidelize-bot-preview-plans"],
    queryFn: () => fetchPlans(),
    enabled: preview === "plans",
    staleTime: 60_000,
  });
  const visible = (plans.data ?? []).filter((p) => p.is_active && !p.archived_at);
  const reset = () => { setPreview("menu"); setSuggestion(""); };
  const money = (value: number, currency: string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Modo do atendimento Fidelize</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Use o bot de três botões para começar sem consumo de tokens.
              Ative a IA somente quando desejar respostas geradas por modelo.
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            {mode === "bot" ? "Bot econômico" : "Atendimento por IA"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            { id: "bot", title: "Bot de atendimento", description: "3 botões, fila de suporte e planos do banco. Sem IA.", Icon: Bot },
            { id: "ai", title: "IA atender", description: "Mantém o agente configurado e pode gerar cobrança de uso.", Icon: BrainCircuit },
          ] as const).map(({ id, title, description, Icon }) => (
            <button key={id} type="button" aria-pressed={mode === id}
              onClick={() => { if (canManage && !saving && mode !== id) onChange(id); }}
              disabled={!canManage || saving}
              className={`flex min-w-0 items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed ${mode === id ? "border-primary bg-primary/5" : "border-border/70 bg-background hover:border-primary/40"}`}>
              <span className="rounded-xl bg-muted p-2"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">{title}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
              </span>
              {mode === id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
        {!canManage && <p className="mt-3 text-xs text-muted-foreground">Somente o superadministrador altera o modo.</p>}
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-sm font-semibold">Prévia interativa de atendimento</h3>
            <p className="text-xs text-muted-foreground">Simulação local. Nenhuma mensagem será enviada pelo WhatsApp.</p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="mr-2 h-3.5 w-3.5" />Reiniciar</Button>
        </div>
        <div className="mx-auto max-w-[390px] overflow-hidden rounded-[28px] border border-emerald-950/20 bg-[#e7e6db] shadow-xl">
          <div className="flex items-center gap-3 bg-[#075e54] p-4 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg font-bold">F</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Fidelize · Suporte</p>
              <p className="text-[11px] text-white/80">Atendimento institucional</p>
            </div>
          </div>
          <div className="min-h-[320px] space-y-3 px-3 py-5">
            {mode === "ai" ? (
              <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-white p-3 text-sm text-[#17312b] shadow-sm">
                Olá! Nosso assistente com IA está disponível. O conteúdo será gerado conforme o provedor configurado.
                <p className="mt-2 text-xs text-[#57716b]">Prévia informativa — sem chamadas de IA</p>
              </div>
            ) : (
              <>
                <div className="max-w-[94%] space-y-3 rounded-xl rounded-tl-sm bg-white p-3 text-sm text-[#17312b] shadow-sm">
                  <p>{SUPPORT_MENU_TEXT}</p>
                  {PLATFORM_SUPPORT_OPTIONS.map((item) => (
                    <button key={item.value} type="button" onClick={() =>
                      setPreview(item.value === "fidelize_support" ? "support" : item.value === "fidelize_plans" ? "plans" : "suggestions")}
                      className="block w-full rounded-lg border border-[#dae6e0] px-3 py-2.5 text-center text-sm font-semibold text-[#147a6c] transition-colors hover:bg-[#edf7f3]">
                      {item.label}
                    </button>
                  ))}
                </div>
                {preview !== "menu" && <>
                  <div className="ml-auto max-w-[75%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-right text-sm text-[#234631] shadow-sm">
                    {preview === "support" ? "Suporte" : preview === "plans" ? "Planos" : "Sugestões"}
                  </div>
                  <div className="max-w-[94%] rounded-xl rounded-tl-sm bg-white p-3 text-sm text-[#17312b] shadow-sm">
                    {preview === "support" ? <>
                      <p>{SUPPORT_QUEUE_TEXT}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-900">Aguardando atendimento</span>
                        <span className="rounded-md bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-800">Suporte</span>
                      </div>
                    </> : preview === "plans" ? <>
                      <p className="font-semibold">Planos Fidelize</p>
                      {plans.isLoading && <p className="mt-2 text-xs">Carregando planos cadastrados…</p>}
                      {plans.isError && <p className="mt-2 text-xs">Não foi possível consultar a prévia dos planos.</p>}
                      {visible.map((plan) => <div key={plan.id} className="mt-2 border-t border-[#e5ede8] pt-2">
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs">
                          {plan.price_monthly == null ? "Sob consulta" : money(Number(plan.price_monthly), plan.currency || "BRL") + " / mês"}
                        </p>
                        {plan.description && <p className="mt-1 text-xs text-[#60726d]">{plan.description}</p>}
                      </div>)}
                    </> : preview === "suggestions" ? <>
                      <p>{SUPPORT_SUGGESTION_REQUEST}</p>
                      <textarea value={suggestion} onChange={(event) => setSuggestion(event.target.value)}
                        placeholder="Escreva sua sugestão..." maxLength={500}
                        className="mt-3 min-h-20 w-full resize-y rounded-lg border border-[#ccd9d3] bg-white p-2 text-sm outline-none focus:border-emerald-700" />
                      <button type="button" disabled={!suggestion.trim()}
                        onClick={() => setPreview("sent")}
                        className="mt-2 flex items-center gap-2 rounded-lg bg-[#087f6c] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        <Send className="h-3.5 w-3.5" />Enviar sugestão
                      </button>
                    </> : <p>{SUPPORT_SUGGESTION_RECEIVED}</p>}
                  </div>
                </>}
              </>
            )}
          </div>
          <div className="border-t border-black/10 bg-[#f4f5ee] p-3 text-center text-[11px] text-[#677c73]">
            Demonstração do atendimento — não envia mensagens
          </div>
        </div>
      </div>
    </div>
  );
}
