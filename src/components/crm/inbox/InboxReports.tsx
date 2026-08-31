import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { minutesLabel } from "./inbox-utils";

type Props = {
  report: any;
  agentNames: Record<string, string>;
};

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function InboxReports({ report, agentNames }: Props) {
  if (!report) return <p className="p-6 text-sm text-muted-foreground">Carregando relatórios…</p>;

  const max = Math.max(1, ...report.series.map((s: any) => Math.max(s.opened, s.closed)));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Conversas no período" value={report.total} hint={`Últimos ${report.days} dias`} />
        <Metric label="Finalizadas" value={report.closed} hint={`${report.open} ainda abertas`} />
        <Metric label="Tempo médio 1ª resposta" value={minutesLabel(report.avgFirstResponseMin)} />
        <Metric label="Tempo médio de resolução" value={minutesLabel(report.avgResolutionMin)} />
        <Metric label="SLA estourado" value={report.slaBreaches} />
        <Metric label="Mensagens recebidas" value={report.inbound} />
        <Metric label="Mensagens enviadas" value={report.outbound} />
        <Metric
          label="Taxa de resolução"
          value={report.total ? `${Math.round((report.closed / report.total) * 100)}%` : "—"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Volume diário</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1">
            {report.series.map((s: any) => (
              <div key={s.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-primary/70" style={{ height: `${(s.opened / max) * 100}%` }} title={`${s.opened} abertas`} />
                  <div className="w-1/2 rounded-t bg-emerald-500/70" style={{ height: `${(s.closed / max) * 100}%` }} title={`${s.closed} finalizadas`} />
                </div>
                <span className="text-[9px] text-muted-foreground">{s.day.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-primary/70" /> Abertas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500/70" /> Finalizadas</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Atendimentos por agente</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.keys(report.perAgent).length === 0 && <p className="text-sm text-muted-foreground">Sem atribuições no período.</p>}
          {Object.entries(report.perAgent).map(([id, count]) => (
            <div key={id} className="flex items-center justify-between text-sm">
              <span>{agentNames[id] ?? "Atendente"}</span>
              <span className="font-medium">{count as number}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
