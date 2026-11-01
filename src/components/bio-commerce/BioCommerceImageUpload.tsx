import { useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type BioCommerceImageKind = "logo" | "cover" | "gallery" | "banner";

type Props = {
  establishmentId: string;
  kind: BioCommerceImageKind;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  label?: string;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** A URL publica so passa a valer depois de Salvar/Publicar no editor. */
export function BioCommerceImageUpload({
  establishmentId, kind, currentUrl, onUploaded, label = "Enviar imagem",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = MIME_EXTENSIONS[file.type];
    if (!extension) {
      toast.error("Use uma imagem PNG, JPG ou WEBP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }
    if (!establishmentId) {
      toast.error("Estabelecimento indisponível para upload.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const fileId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `establishments/${establishmentId}/bio-commerce/${kind}/${fileId}.${extension}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      if (!data.publicUrl) throw new Error("Não foi possível obter a URL pública.");
      onUploaded(data.publicUrl);
      toast.success("Imagem enviada. Salve para publicar a alteração.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {currentUrl ? (
        <img src={currentUrl} alt="Prévia da imagem" className="h-16 w-24 rounded-xl border object-cover" loading="lazy" />
      ) : (
        <span className="grid h-16 w-24 place-items-center rounded-xl border border-dashed bg-muted/20 text-muted-foreground">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-1">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleChange} className="hidden" aria-label={label} />
        <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? "Enviando…" : label}
        </Button>
        <p className="text-[10px] text-muted-foreground">PNG, JPG ou WEBP · até 5 MB</p>
      </div>
    </div>
  );
}
