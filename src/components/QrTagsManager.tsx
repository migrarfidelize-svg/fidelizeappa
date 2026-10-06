import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MapPin, Copy, Download, Trash2, QrCode, Plus, Layers, Power, ChevronDown } from "lucide-react";
import {
  listQrTags, createQrTag, bulkCreateQrTags, updateQrTag, deleteQrTag,
} from "@/lib/qr-tags.functions";

type QrTag = {
  id: string;
  code: string;
  label: string;
  location: string | null;
  destination: "reviews" | "linktree" | "landing" | "menu" | null;
  active: boolean;
  scans_count: number;
  created_at: string;
};

type Props = { establishmentId: string };

const DEST_LABEL: Record<string, string> = {
  reviews: "Avaliação",
  linktree: "Bio Commerce",
  landing: "Cartão Fidelidade",
  menu: "Cardápio digital",
};

export function QrTagsManager({ establishmentId }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listQrTags);
  const createFn = useServerFn(createQrTag);
  const bulkFn = useServerFn(bulkCreateQrTags);
  const updateFn = useServerFn(updateQrTag);
  const deleteFn = useServerFn(deleteQrTag);

  const { data: tags = [], isLoading } = useQuery<QrTag[]>({
    queryKey: ["qr-tags", establishmentId],
    queryFn: () => listFn({ data: { establishmentId } }) as any,
    enabled: !!establishmentId,
  });

  const [expanded, setExpanded] = useState(false);
  const isEmpty = !isLoading && tags.length === 0;
  const open = expanded || (!isLoading && tags.length > 0);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const invalidate = () => qc.invalidateQueries({ queryKey: ["qr-tags", establishmentId] });

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              QR Codes por local
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gere um QR único para cada mesa, balcão ou suporte — com nome próprio e contagem de acessos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEmpty && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                <ChevronDown className={`mr-1.5 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Ocultar" : "Saiba mais"}
              </Button>
            )}
            <CreateSingleDialog establishmentId={establishmentId} onDone={invalidate} createFn={createFn} />
            <BulkCreateDialog establishmentId={establishmentId} onDone={invalidate} bulkFn={bulkFn} />
          </div>
        </div>
      </CardHeader>
      {(isLoading || open) && (
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : tags.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <QrCode className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Nenhum QR identificado ainda</p>
            <p className="text-xs text-muted-foreground">
              Crie um por local para saber exatamente de onde vêm os acessos.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((t) => (
              <QrTagCard
                key={t.id}
                tag={t}
                origin={origin}
                onDelete={async () => {
                  await deleteFn({ data: { id: t.id } });
                  toast.success("QR removido");
                  invalidate();
                }}
                onToggle={async () => {
                  await updateFn({ data: { id: t.id, active: !t.active } });
                  invalidate();
                }}
                onRename={async (label, location, destination) => {
                  await updateFn({
                    data: { id: t.id, label, location: location || null, destination: destination ?? null },
                  });
                  toast.success("QR atualizado");
                  invalidate();
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}

function tagUrl(origin: string, code: string) {
  return `${origin}/api/public/r/t/${code}`;
}

function QrTagCard({
  tag, origin, onDelete, onToggle, onRename,
}: {
  tag: QrTag;
  origin: string;
  onDelete: () => Promise<void>;
  onToggle: () => Promise<void>;
  onRename: (label: string, location: string, destination: QrTag["destination"]) => Promise<void>;
}) {
  const url = tagUrl(origin, tag.code);
  const [preview, setPreview] = useState<string>("");

  useMemo(() => {
    QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: "M" }).then(setPreview).catch(() => {});
  }, [url]);

  async function download() {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#111827", light: "#ffffff" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${tag.label.replace(/\s+/g, "-").toLowerCase()}-${tag.code}.png`;
    a.click();
  }

  return (
    <div className={`rounded-xl border bg-card p-3 ${tag.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{tag.label}</p>
            {!tag.active && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Inativo</Badge>}
          </div>
          {tag.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {tag.location}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {DEST_LABEL[tag.destination ?? "reviews"]} · {tag.scans_count} acesso{tag.scans_count === 1 ? "" : "s"}
          </p>
        </div>
        {preview && (
          <img src={preview} alt={`QR ${tag.label}`} className="h-16 w-16 shrink-0 rounded-md border bg-white" />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Link copiado!");
          }}
        >
          <Copy className="mr-1 h-3 w-3" /> Copiar link
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={download}>
          <Download className="mr-1 h-3 w-3" /> PNG
        </Button>
        <EditTagDialog tag={tag} onSave={onRename} />
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onToggle} title={tag.active ? "Desativar" : "Reativar"}>
          <Power className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover este QR?</AlertDialogTitle>
              <AlertDialogDescription>
                O QR "{tag.label}" deixará de funcionar imediatamente. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function EditTagDialog({
  tag, onSave,
}: {
  tag: QrTag;
  onSave: (label: string, location: string, destination: QrTag["destination"]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(tag.label);
  const [location, setLocation] = useState(tag.location ?? "");
  const [destination, setDestination] = useState<string>(tag.destination ?? "default");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">Editar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar QR</DialogTitle>
          <DialogDescription>Ajuste o nome, local ou destino deste QR.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Ex.: Mesa 12" />
          </div>
          <div>
            <Label>Local (opcional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="Ex.: Salão principal" />
          </div>
          <div>
            <Label>Destino</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar padrão do estabelecimento</SelectItem>
                <SelectItem value="reviews">Avaliação</SelectItem>
                <SelectItem value="linktree">Bio Commerce</SelectItem>
                <SelectItem value="landing">Cartão Fidelidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={saving || label.trim().length === 0}
            onClick={async () => {
              setSaving(true);
              try {
                const dest = destination === "default" ? null : (destination as QrTag["destination"]);
                await onSave(label.trim(), location.trim(), dest);
                setOpen(false);
              } finally { setSaving(false); }
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSingleDialog({
  establishmentId, onDone, createFn,
}: {
  establishmentId: string;
  onDone: () => void;
  createFn: ReturnType<typeof useServerFn<typeof createQrTag>>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [location, setLocation] = useState("");
  const [destination, setDestination] = useState<string>("default");
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      const dest = destination === "default" ? null : (destination as any);
      await createFn({
        data: {
          establishmentId,
          label: label.trim(),
          location: location.trim() || null,
          destination: dest,
        },
      });
      toast.success("QR criado!");
      setLabel(""); setLocation(""); setDestination("default");
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar QR");
    } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Novo QR</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo QR identificado</DialogTitle>
          <DialogDescription>Ex.: "Mesa 1", "Balcão", "Guardanapo 03".</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Mesa 1" maxLength={80} autoFocus />
          </div>
          <div>
            <Label>Local (opcional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Salão principal" maxLength={80} />
          </div>
          <div>
            <Label>Destino</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar padrão do estabelecimento</SelectItem>
                <SelectItem value="reviews">Avaliação</SelectItem>
                <SelectItem value="linktree">Bio Commerce</SelectItem>
                <SelectItem value="landing">Cartão Fidelidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={saving || label.trim().length === 0} onClick={submit}>
            {saving ? "Criando…" : "Criar QR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCreateDialog({
  establishmentId, onDone, bulkFn,
}: {
  establishmentId: string;
  onDone: () => void;
  bulkFn: ReturnType<typeof useServerFn<typeof bulkCreateQrTags>>;
}) {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState("Mesa");
  const [start, setStart] = useState(1);
  const [count, setCount] = useState(10);
  const [location, setLocation] = useState("");
  const [destination, setDestination] = useState<string>("default");
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      const dest = destination === "default" ? null : (destination as any);
      const res: any = await bulkFn({
        data: {
          establishmentId,
          prefix: prefix.trim(),
          start,
          count,
          location: location.trim() || null,
          destination: dest,
        },
      });
      toast.success(`${res.created} QR${res.created === 1 ? "" : "s"} criado${res.created === 1 ? "" : "s"}`);
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar em lote");
    } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><Layers className="mr-1 h-4 w-4" /> Em lote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar vários QR de uma vez</DialogTitle>
          <DialogDescription>
            Gera uma sequência, ex.: "Mesa 1" até "Mesa 20". Cada QR recebe um código único.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Prefixo *</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={40} placeholder="Mesa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Começar em</Label>
              <Input type="number" min={1} max={999} value={start} onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div>
            <Label>Local (opcional)</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="Ex.: Salão principal" />
          </div>
          <div>
            <Label>Destino</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar padrão do estabelecimento</SelectItem>
                <SelectItem value="reviews">Avaliação</SelectItem>
                <SelectItem value="linktree">Bio Commerce</SelectItem>
                <SelectItem value="landing">Cartão Fidelidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Prévia: <span className="font-medium">{prefix} {start}</span>, {prefix} {start + 1}, …, {prefix} {start + count - 1}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={saving || prefix.trim().length === 0} onClick={submit}>
            {saving ? "Criando…" : `Criar ${count}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
