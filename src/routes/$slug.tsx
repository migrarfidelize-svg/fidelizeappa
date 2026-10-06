import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BioCommercePublicPageV3 } from "@/components/bio-commerce/BioCommercePublicPageV3";
import { getPublicLinkTreeBySlug } from "@/lib/linktree.functions";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-linktree", slug],
    queryFn: () => getPublicLinkTreeBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!data) throw notFound();
    const { applySeoCacheHeaders } = await import("@/lib/seo-cache.server");
    applySeoCacheHeaders({
      version: [
        (data as any).page?.updated_at,
        (data as any).establishment?.updated_at,
        (data as any).establishment?.logo_url,
        (data as any).links?.length,
        "bio-commerce-v3",
      ],
    });
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.establishment.name} — Bio Commerce` },
          {
            name: "description",
            content:
              loaderData.page?.description ??
              loaderData.establishment.description ??
              `Vitrine digital oficial de ${loaderData.establishment.name}`,
          },
          { property: "og:title", content: `${loaderData.establishment.name} — Bio Commerce` },
          {
            property: "og:description",
            content: loaderData.page?.description ?? `Vitrine digital oficial de ${loaderData.establishment.name}`,
          },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Não encontrado" }, { name: "robots", content: "noindex" }],
  }),
  component: BioCommerceRoute,
  errorComponent: BioCommerceError,
  notFoundComponent: BioCommerceNotFound,
});

function BioCommerceRoute() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  return <BioCommercePublicPageV3 data={data! as any} slug={slug} />;
}

function BioCommerceError({ error }: { error: Error }) {
  const msg = error instanceof Error ? error.message : String(error);
  const title = msg === "INACTIVE" ? "Estabelecimento indisponível" : msg === "UNPUBLISHED" ? "Bio Commerce em construção" : "Ops! Algo deu errado";
  const description = msg === "INACTIVE" ? "Esta página está temporariamente desativada." : msg === "UNPUBLISHED" ? "Este estabelecimento ainda não publicou seu Bio Commerce." : "Não foi possível carregar esta página. Tente novamente em instantes.";
  return <StatusPage title={title} description={description} />;
}

function BioCommerceNotFound() {
  return <StatusPage title="Bio Commerce não encontrado" description="O endereço pode ter sido alterado ou não existe." />;
}

function StatusPage({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-dvh place-items-center bg-neutral-950 p-6 text-center text-white"><div><h1 className="font-display text-3xl font-bold">{title}</h1><p className="mt-2 text-white/60">{description}</p><Link to="/" className="mt-6 inline-block underline underline-offset-4">Voltar</Link></div></div>;
}
