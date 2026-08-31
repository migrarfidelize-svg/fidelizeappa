import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lookupReferralCode, trackReferralEvent } from "@/lib/retention.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/r/$code")({
  head: ({ params }) => {
    const url = `https://afidelize.app/r/${params.code}`;
    const title = "Você ganhou uma indicação — Fidelize";
    const description =
      "Aceite a indicação de um amigo, crie seu cartão fidelidade digital e ganhe carimbos-bônus na hora.";
    const image = "https://afidelize.app/logo-mark.svg";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: "Fidelize — cartão fidelidade digital" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ReferralLanding,
});

function ReferralLanding() {
  const { code } = Route.useParams();
  const lookup = useServerFn(lookupReferralCode);
  const track = useServerFn(trackReferralEvent);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["ref", code],
    queryFn: () => lookup({ data: { code } }),
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const utm = {
          source: url.searchParams.get("utm_source") ?? undefined,
          medium: url.searchParams.get("utm_medium") ?? undefined,
          campaign: url.searchParams.get("utm_campaign") ?? undefined,
          content: url.searchParams.get("utm_content") ?? undefined,
        };
        sessionStorage.setItem("fidelize_referral_code", code.toUpperCase());
        // Persist UTM so signup attribution can pick it up later.
        sessionStorage.setItem("fidelize_referral_utm", JSON.stringify(utm));
        // De-dupe click tracking: only log once per code per session.
        const key = `fidelize_ref_click_${code.toUpperCase()}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          track({ data: { code, kind: "click", utm } }).catch(() => {});
        }
      } catch {
        /* noop */
      }
    }
  }, [code, track]);


  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Código não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Este link de indicação expirou ou não é válido.</p>
            <Button asChild variant="outline">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const est = data.establishment;
  return (
    <div className="min-h-dvh bg-gradient-to-br from-background to-muted grid place-items-center p-6">
      <Card className="max-w-md w-full overflow-hidden">
        {est.logo_url && (
          <div
            className="h-24 flex items-center justify-center"
            style={{ backgroundColor: est.primary_color ?? "hsl(var(--primary))" }}
          >
            <img
              src={est.logo_url}
              alt={est.name}
              className="h-16 w-16 rounded-full bg-background object-cover ring-4 ring-background"
            />
          </div>
        )}
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gift className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Você foi indicado por {data.referrerName}!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Cadastre-se no cartão fidelidade da <strong>{est.name}</strong> e ganhe carimbos-bônus
            já na primeira visita. Seu amigo também é recompensado!
          </p>
          <p className="text-xs">
            Código de indicação: <span className="font-mono font-bold">{code.toUpperCase()}</span>
          </p>
          <Button
            className="w-full"
            onClick={() =>
              navigate({
                to: "/cartao/$slug",
                params: { slug: est.slug },
                search: { ref: code.toUpperCase() },
              })
            }
          >
            Continuar cadastro
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Ao continuar, você aceita nossos{" "}
            <Link to="/termos" className="underline">
              termos
            </Link>{" "}
            e{" "}
            <Link to="/privacidade" className="underline">
              política de privacidade
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
