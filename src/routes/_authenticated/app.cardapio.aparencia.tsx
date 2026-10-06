import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseDisplay } from "@/components/showcase/ShowcaseDisplay";

export const Route = createFileRoute("/_authenticated/app/cardapio/aparencia")({
  head: () => ({
    meta: [
      { title: "Exibição do Cardápio — Fidelize" },
      { name: "description", content: "Defina como pratos e categorias aparecem quando o Cardápio é aberto diretamente." },
    ],
  }),
  component: () => <ShowcaseDisplay kind="menu" />,
});
