import { createFileRoute } from "@tanstack/react-router";
import { BioCommerceEditorV3 } from "@/components/bio-commerce/BioCommerceEditorV3";

export const Route = createFileRoute("/_authenticated/app/linktree")({
  ssr: false,
  component: BioCommerceEditorV3,
});
