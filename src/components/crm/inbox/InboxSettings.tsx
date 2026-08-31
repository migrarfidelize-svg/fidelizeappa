import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

type Props = {
  queues: any[];
  closeReasons: any[];
  canManage: boolean;
  onSaveQueue: (payload: { id?: string; name: string; slaFirstResponseMin: number; slaResolutionMin: number }) => void;
  onDeleteQueue: (id: string) => void;
  onSaveReason: (payload: { name: string }) => void;
};

export function InboxOperationSettings({ queues, closeReasons, canManage, onSaveQueue, onDeleteQueue, onSaveReason }: Props) {
  const [queueName, setQueueName] = useState("");
  const [firstResponse, setFirstResponse] = useState(15);
  const [resolution, setResolution] = useState(240);
  const [reasonName, setReasonName] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Filas de atendimento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {queues.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fila criada. As conversas usam a fila geral.</p>}
            {queues.map((q) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{q.name}</p>
                  <p className="text-xs text-muted-foreground">
                    SLA 1ª resposta {q.sla_first_response_min} min · resolução {q.sla_resolution_min} min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!q.active && <Badge variant="outline" className="text-[10px]">inativa</Badge>}
                  {canManage && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDeleteQueue(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {canManage && (
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <Label className="text-xs">Nova fila</Label>
              <Input value={queueName} onChange={(e) => setQueueName(e.target.value)} placeholder="Ex.: Suporte técnico" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-muted-foreground">SLA 1ª resposta (min)</Label>
                  <Input type="number" value={firstResponse} onChange={(e) => setFirstResponse(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">SLA resolução (min)</Label>
                  <Input type="number" value={resolution} onChange={(e) => setResolution(Number(e.target.value))} />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!queueName.trim()}
                onClick={() => {
                  onSaveQueue({ name: queueName.trim(), slaFirstResponseMin: firstResponse, slaResolutionMin: resolution });
                  setQueueName("");
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Criar fila
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Motivos de encerramento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {closeReasons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum motivo cadastrado.</p>}
            {closeReasons.map((r) => (
              <Badge key={r.id} variant="outline">{r.name}</Badge>
            ))}
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Input value={reasonName} onChange={(e) => setReasonName(e.target.value)} placeholder="Ex.: Dúvida resolvida" />
              <Button
                size="sm"
                disabled={!reasonName.trim()}
                onClick={() => {
                  onSaveReason({ name: reasonName.trim() });
                  setReasonName("");
                }}
              >
                Adicionar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
