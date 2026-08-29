import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * A gestão de API/integrações da plataforma passou a ser exclusiva da área
 * administrativa. Qualquer acesso direto a /app/api é redirecionado; o gate de
 * /hash bloqueia quem não for administrador da plataforma.
 */
export const Route = createFileRoute("/_authenticated/app/api")({
  beforeLoad: () => {
    throw redirect({ to: "/hash/api-integracoes", replace: true });
  },
});
