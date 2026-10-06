import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, LayoutGrid, List, MonitorSmartphone, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteLoading } from "@/components/RouteLoading";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyMenuOverview, updateMenuTheme } from "@/lib/menu.functions";
import {
  CATALOG_ONLY_LAYOUTS,
  MENU_ENTRIES,
  MENU_LAYOUTS,
  resolveMenuTheme,
  type MenuEntryId,
  type MenuLayoutId,
  type MenuThemeConfig,
} from "@/lib/menu-themes";

export function ShowcaseDisplay({ kind }: { kind: "menu" | "catalog" }) {
  const queryClient = useQueryClient();
  const getEstablishments = useServerFn(getMyEstablishments);
  const getOverview = useServerFn(getMyMenuOverview);
  const saveTheme = useServerFn(updateMenuTheme);
  const { data: memberships, isLoading: loadingMemberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEstablishments() });
  const establishment = memberships?.[0]?.establishment as any;
  const overview = useQuery({
    queryKey: ["menu-overview", establishment?.id, kind],
    queryFn: () => getOverview({ data: { establishment_id: establishment!.id, kind } }),
    enabled: !!establishment?.id,
  });
  const resolved = useMemo(() => resolveMenuTheme(overview.data?.menu?.theme), [overview.data?.menu?.theme]);
  const [layout, setLayout] = useState<MenuLayoutId>("list");
  const [entry, setEntry] = useState<MenuEntryId>("dishes");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLayout(resolved.layout);
    setEntry(resolved.entry);
  }, [resolved.layout, resolved.entry]);

  if (loadingMemberships || !establishment || overview.isLoading) return <RouteLoading label="Carregando exibição…" fullscreen={false} className="min-h-[50vh]" />;

  const layouts = MENU_LAYOUTS.filter((item) => kind === "catalog" || !CATALOG_ONLY_LAYOUTS.includes(item.id));
  const title = kind === "catalog" ? "Exibição do Catálogo" : "Exibição do Cardápio";
  const noun = kind === "catalog" ? "catálogo" : "cardápio";

  async function save() {
    if (!establishment) return;
    setSaving(true);
    try {
      const preserved: MenuThemeConfig = {
        preset: resolved.preset,
        layout,
        pattern: resolved.pattern,
        entry: kind === "menu" ? entry : resolved.entry,
        bg_color: resolved.bg_color,
        accent_color: resolved.accent_color,
        text_color: resolved.text_color,
        bg_image_url: resolved.bg_image_url,
      };
      await saveTheme({ data: { establishment_id: establishment.id, kind, theme: preserved } });
      await queryClient.invalidateQueries({ queryKey: ["menu-overview", establishment.id, kind] });
      toast.success("Exibição atualizada.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível salvar a exibição.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto w-full max-w-6xl space-y-5 p-3 sm:p-5 lg:p-7">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-primary" /><h1 className="font-display text-2xl font-black">{title}</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Defina como os itens aparecem neste canal, sem repetir a identidade visual da sua marca.</p>
      </div>
      <Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando…" : "Salvar exibição"}</Button>
    </header>

    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></span>
          <div><p className="font-black">Identidade centralizada no Bio Commerce</p><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Logo, capa, cores e linguagem principal da marca são definidos no Bio Commerce. Aqui você escolhe apenas a forma de apresentar o {noun}. As configurações visuais já existentes deste canal são preservadas para não quebrar páginas publicadas.</p></div>
        </div>
        <Button variant="outline" asChild><a href="/app/linktree">Abrir Bio Commerce</a></Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary" />Layout dos itens</CardTitle><p className="text-sm text-muted-foreground">Escolha a organização que melhor combina com o conteúdo. Isso não altera seus produtos, preços ou links.</p></CardHeader>
      <CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{layouts.map((item) => <button key={item.id} type="button" onClick={() => setLayout(item.id)} className={`relative rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${layout === item.id ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border"}`}><div className="mb-3 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-muted">{item.id === "list" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}</span>{layout === item.id && <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}</div><p className="text-sm font-black">{item.name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p></button>)}</div></CardContent>
    </Card>

    {kind === "menu" && <Card><CardHeader><CardTitle>Entrada do Cardápio</CardTitle><p className="text-sm text-muted-foreground">Escolha o primeiro passo da navegação quando alguém abrir o Cardápio diretamente por link ou QR Code.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2">{MENU_ENTRIES.map((item) => <button key={item.id} type="button" onClick={() => setEntry(item.id)} className={`rounded-2xl border-2 p-4 text-left transition ${entry === item.id ? "border-primary bg-primary/5" : "border-border"}`}><div className="flex items-center justify-between"><p className="text-sm font-black">{item.name}</p>{entry === item.id && <Check className="h-4 w-4 text-primary" />}</div><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></button>)}</div></CardContent></Card>}

    <Card><CardHeader><CardTitle>Como isso se conecta ao Bio Commerce</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Info title="Bio Commerce" text="Apresenta a marca, links, vídeos, produtos ou serviços de acordo com o perfil do negócio." /><Info title={kind === "catalog" ? "Catálogo" : "Cardápio"} text={`Continua sendo o módulo operacional para cadastrar e organizar ${kind === "catalog" ? "produtos" : "pratos"}.`} /><Info title="Exibição" text="Controla somente como este canal especializado é navegado quando aberto diretamente." /></CardContent></Card>
  </div>;
}

function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border bg-muted/20 p-4"><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}
