import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseDisplay } from "@/components/showcase/ShowcaseDisplay";

export const Route = createFileRoute("/_authenticated/app/catalogo/aparencia")({
  head: () => ({
    meta: [
      { title: "Exibição do Catálogo — Fidelize" },
      { name: "description", content: "Defina como produtos e coleções aparecem quando o Catálogo é aberto diretamente." },
    ],
  }),
  component: () => <ShowcaseDisplay kind="catalog" />,
});
