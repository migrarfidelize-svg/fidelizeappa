import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getQrDestinationStatus, setQrDestination } from "@/lib/linktree.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Lock } from "lucide-react";
import { qrDestinationPath } from "@/lib/qr-destination-url";

type Dest = "reviews" | "linktree" | "landing" | "menu" | "catalog";

export function QrDestinationCard({
  establishmentId,
  initialDest,
}: {
  establishmentId: string;
  /** Quando vem de um atalho "Configurar QR Code", já aplica esse destino. */
  initialDest?: Dest;
}) {
  const getFn = useServerFn(getQrDestinationStatus);
  const setFn = useServerFn(setQrDestination);
  const q = useQuery({
    queryKey: ["qr-destination", establishmentId],
    queryFn: () => getFn({ data: { establishment_id: establishmentId } }),
  });
  const [dest, setDest] = useState<Dest>("reviews");
  const [saving, setSaving] = useState(false);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (q.data?.destination) setDest(q.data.destination);
  }, [q.data?.destination]);

  // Aplica o destino pedido pelo atalho apenas uma vez, quando difere do atual.
  useEffect(() => {
    if (!initialDest || appliedRef.current || !q.data) return;
    appliedRef.current = true;
    if (q.data.destination !== initialDest) void save(initialDest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDest, q.data]);

  const linktreeReady = !!q.data?.linktree_published;
  const reviewsReady = !!q.data?.review_form_active;
  const menuAllowed = !!q.data?.menu_allowed;
  const menuReady = menuAllowed && !!q.data?.menu_published;
  const catalogAllowed = !!q.data?.catalog_allowed;
  const catalogReady = catalogAllowed && !!q.data?.catalog_published;
  const isShowcase = dest === "menu" || dest === "catalog";
  const isCatalog = dest === "catalog";

  async function save(next: Dest) {
    const prev = dest;
    setDest(next);
    setSaving(true);
    try {
      await setFn({ data: { establishment_id: establishmentId, destination: next } });
      toast.success("Destino do QR atualizado.");
      if (typeof window !== "undefined" && prev !== next) {
        window.dispatchEvent(
          new CustomEvent("qr-destination-changed", { detail: { from: prev, to: next, establishmentId } })
        );
      }
      q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const showWarning =
    (dest === "linktree" && !linktreeReady) ||
    (dest === "reviews" && !reviewsReady) ||
    (dest === "menu" && !menuReady) ||
    (dest === "catalog" && !catalogReady);

  return (
    <Card className="border-primary/20 bg-card/70">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
          <div className="min-w-0">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Para onde o QR leva
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              O QR físico continua o mesmo — você troca o destino a qualquer momento.
            </p>
          </div>
          <Select value={dest} onValueChange={(v) => save(v as Dest)} disabled={saving}>
            <SelectTrigger className="h-11 w-full shrink-0 sm:h-10 sm:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reviews">Avaliação de atendimento</SelectItem>
              <SelectItem value="linktree">Bio Commerce</SelectItem>
              <SelectItem value="landing">Cartão Fidelidade</SelectItem>
              <SelectItem value="menu" disabled={!menuAllowed}>
                Cardápio digital{!menuAllowed ? " (não incluso no plano)" : ""}
              </SelectItem>
              <SelectItem value="catalog" disabled={!catalogAllowed}>
                Catálogo digital{!catalogAllowed ? " (não incluso no plano)" : ""}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>


        {showWarning ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            {isShowcase ? (
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {(isCatalog ? catalogAllowed : menuAllowed)
                    ? `Seu ${isCatalog ? "catálogo" : "cardápio"} ainda não está publicado — o QR cai na página de avaliação até publicar.`
                    : `O ${isCatalog ? "Catálogo" : "Cardápio"} digital não está incluído no seu plano atual.`}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  {(isCatalog ? catalogAllowed : menuAllowed) ? (
                    <Link to={isCatalog ? "/app/catalogo" : "/app/cardapio"}>
                      Publicar {isCatalog ? "catálogo" : "cardápio"}
                    </Link>
                  ) : (
                    <Link to="/app/planos"><Lock className="mr-1.5 h-3.5 w-3.5" />Ver planos</Link>
                  )}
                </Button>
              </div>
            ) : dest === "linktree" ? (
              <div className="min-w-0 flex-1">
                <p className="font-medium">Você ainda não possui um Bio Commerce publicado.</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/app/linktree">Criar Bio Commerce</Link>
                </Button>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="font-medium">Você ainda não possui uma avaliação ativa.</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/app/avaliacoes">Configurar avaliação</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs min-w-0">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="min-w-0 text-muted-foreground">
              Destino ativo e pronto para receber scans.
            </span>
            {q.data?.slug && (
              <a
                href={`/${qrDestinationPath(dest)}/${q.data.slug}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
              >
                Ver <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
