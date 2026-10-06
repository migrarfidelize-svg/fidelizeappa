import { createFileRoute } from "@tanstack/react-router";
import { BioCommerceEditor } from "@/components/bio-commerce/BioCommerceEditor";

export const Route = createFileRoute("/_authenticated/app/linktree")({
  ssr: false,
  component: BioCommerceEditor,
});
