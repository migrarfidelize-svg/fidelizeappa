import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Wallet, BadgePercent, Receipt, ArrowUpRight, Mail, CheckCircle2, ShieldCheck, Search } from "lucide-react";
import { getAdminAffiliates, adminUpdateAffiliate, adminUpdateAffiliateSettings, adminFinalizeAffiliateWithdrawal, adminNotifyAffiliate } from "@/lib/affiliate.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoading } from "@/components/RouteLoading";

export const Route = createFileRoute("/_authenticated/hash/afiliados")({component:AdminAffiliates});
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const dateTime=(s:string)=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
function AdminAffiliates(){
 const load=useServerFn(getAdminAffiliates);
 const update=useServerFn(adminUpdateAffiliate);
 const setSettings=useServerFn(adminUpdateAffiliateSettings);
 const finalize=useServerFn(adminFinalizeAffiliateWithdrawal);
 const notify=useServerFn(adminNotifyAffiliate);
 const qc=useQueryClient();
 const {data,isLoading,error}=useQuery({queryKey:["affiliate-admin"],queryFn:()=>load()});
 const [filter,setFilter]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [pct,setPct]=useState("10");
 const [enabled,setEnabled]=useState(true);
 const [defaultRate,setDefaultRate]=useState("");
 const [releaseDays,setReleaseDays]=useState("");
 const [busy,setBusy]=useState(false);
 const [notifyEst,setNotifyEst]=useState<string|null>(null);
 const [notifyTitle,setNotifyTitle]=useState("");
 const [notifyBody,setNotifyBody]=useState("");
 const [payingId,setPayingId]=useState<string|null>(null);
 const [receipt,setReceipt]=useState("");
 const [payoutNotes,setPayoutNotes]=useState("");
 const refresh=()=>qc.invalidateQueries({queryKey:["affiliate-admin"]});
 async function perform(fn:()=>Promise<unknown>,success:string){
  setBusy(true);try{await fn();toast.success(success);await refresh();}catch(e){toast.error(e instanceof Error?e.message:"Falha na operação.");}finally{setBusy(false);}
 }
 if(isLoading)return <RouteLoading label="Carregando programa de afiliados…" fullscreen={false} className="min-h-[50vh]"/>;
 if(error)return <div className="p-8 text-destructive">{String(error)}</div>;
 if(!data)return null;
 const rows=data.affiliates.filter((a:any)=>[a.establishments?.name,a.code].some(v=>String(v||"").toLowerCase().includes(filter.toLowerCase())));
 const requests=data.withdrawals.filter((w:any)=>["requested","processing"].includes(w.status));
 return <div className="space-y-6 p-3 sm:p-6 lg:p-8">
   <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-[#0d0920] px-6 py-8 text-white sm:p-10">
     <p className="text-xs font-extrabold uppercase tracking-[.25em] text-violet-300">Controle financeiro Fidelize</p>
     <h1 className="mt-2 text-3xl font-black sm:text-4xl">Programa de Afiliados</h1>
     <p className="mt-2 max-w-2xl text-sm text-white/60">Controle por venda efetivamente paga, porcentagens individualizadas, carteira auditável e saques realizados manualmente. O cadastro isolado nunca gera comissão.</p>
     <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">{[
       ["Afiliados",String(data.affiliates.length),Users],
       ["Cadastros",String(data.referrals.length),Receipt],
       ["Comissões confirmadas",money(data.affiliates.reduce((s:number,a:any)=>s+a.earned,0)),BadgePercent],
       ["Saques aguardando",String(requests.length),Wallet]
     ].map(([title,value,Icon]:any)=><div key={title} className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><Icon className="mb-3 h-5 w-5 text-violet-300"/><p className="text-xs text-white/55">{title}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}</div>
   </section>
   <Card className="rounded-3xl"><CardContent className="p-6">
     <h2 className="text-lg font-bold">Regras de comissão</h2><p className="mt-1 text-sm text-muted-foreground">Padrão para novos afiliados e prazo até liberar o saldo após aprovação do gateway.</p>
     <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><div><label className="text-xs font-semibold">Comissão padrão (%)</label><Input type="number" min="0" max="100" step="0.01" value={defaultRate||String(data.settings?.default_rate??10)} onChange={e=>setDefaultRate(e.target.value)}/></div><div><label className="text-xs font-semibold">Prazo de liberação (dias)</label><Input type="number" min="0" max="90" value={releaseDays||String(data.settings?.release_days??7)} onChange={e=>setReleaseDays(e.target.value)}/></div><Button className="self-end" disabled={busy} onClick={()=>perform(()=>setSettings({data:{default_rate:Number(defaultRate||data.settings?.default_rate),release_days:Number(releaseDays||data.settings?.release_days)}}),"Regras atualizadas.")}>Salvar regras</Button></div>
   </CardContent></Card>
   <Card className="rounded-3xl"><CardContent className="p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Afiliados cadastrados</h2><p className="text-sm text-muted-foreground">Cada lojista possui seu percentual, link e carteira separados.</p></div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Buscar empresa ou código" value={filter} onChange={e=>setFilter(e.target.value)}/></div></div>
   <div className="mt-5 space-y-3">{rows.length?rows.map((a:any)=><div key={a.establishment_id} className="rounded-2xl border p-4">
     <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{a.establishments?.name||"Estabelecimento"}</h3><p className="text-xs text-muted-foreground">afidelize.app/?ref={a.code}</p><p className="mt-1 text-xs text-muted-foreground">{a.registrations} cadastros · {money(a.earned)} em comissões · {money(a.available)} disponível · {money(a.paid)} sacado</p></div>
     <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>{setEditing(editing===a.establishment_id?null:a.establishment_id);setPct(String(a.commission_rate??data.settings?.default_rate??10));setEnabled(a.enabled);}}> <BadgePercent className="mr-1 h-3.5 w-3.5"/>Gerenciar</Button><Button size="sm" variant="outline" onClick={()=>{setNotifyEst(notifyEst===a.establishment_id?null:a.establishment_id);setNotifyTitle("");setNotifyBody("");}}><Mail className="mr-1 h-3.5 w-3.5"/>Notificar</Button></div></div>
     {notifyEst===a.establishment_id&&<div className="mt-4 space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
       <p className="text-sm font-bold">Notificação interna para {a.establishments?.name}</p>
       <Input value={notifyTitle} maxLength={120} placeholder="Assunto da mensagem" onChange={e=>setNotifyTitle(e.target.value)}/>
       <textarea className="min-h-[90px] w-full rounded-xl border bg-background p-3 text-sm" value={notifyBody} maxLength={1000} placeholder="Escreva uma mensagem ao afiliado" onChange={e=>setNotifyBody(e.target.value)}/>
       <Button size="sm" disabled={busy||notifyTitle.trim().length<4||notifyBody.trim().length<4} onClick={()=>void perform(async()=>{await notify({data:{establishment_id:a.establishment_id,title:notifyTitle,body:notifyBody}});setNotifyEst(null);},"Notificação enviada.")}>Enviar mensagem</Button>
     </div>}
     {editing===a.establishment_id&&<div className="mt-4 grid gap-3 rounded-xl bg-muted/30 p-4 sm:grid-cols-[1fr_auto_auto]"><div><label className="text-xs font-semibold">Comissão deste afiliado (%)</label><Input type="number" min="0" max="100" step="0.01" value={pct} onChange={e=>setPct(e.target.value)}/></div><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Afiliado ativo</label><Button className="self-end" disabled={busy} onClick={()=>perform(()=>update({data:{establishment_id:a.establishment_id,commission_rate:Number(pct),enabled}}),"Afiliado atualizado.")}>Salvar</Button></div>}
   </div>):<p className="text-sm text-muted-foreground">Nenhum afiliado encontrado.</p>}</div>
   </CardContent></Card>
   <Card className="rounded-3xl"><CardContent className="p-6"><h2 className="text-lg font-bold">Solicitações de saque</h2><p className="mt-1 text-sm text-muted-foreground">Confirme somente após realizar a transferência fora da Fidelize. A referência registrada fica no histórico definitivo.</p>
    <div className="mt-5 space-y-3">{requests.length?requests.map((w:any)=>{const affiliate=data.affiliates.find((a:any)=>a.establishment_id===w.establishment_id);return <div key={w.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
      <div><h3 className="font-bold">{affiliate?.establishments?.name||"Afiliado"} · {money(Number(w.amount))}</h3><p className="text-xs text-muted-foreground">Solicitado em {dateTime(w.requested_at)} · Status: {w.status}</p><p className="mt-1 select-text text-xs">Chave Pix: <strong>{w.pix_key}</strong></p></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>perform(()=>finalize({data:{withdrawal_id:w.id,status:"processing"}}),"Saque marcado para processamento.")}>Em processamento</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>{if(!window.confirm("Rejeitar solicitação e devolver o saldo reservado?"))return;void perform(()=>finalize({data:{withdrawal_id:w.id,status:"rejected"}}),"Saque rejeitado.");}}>Rejeitar</Button><Button size="sm" disabled={busy} onClick={()=>{setPayingId(payingId===w.id?null:w.id);setReceipt("");setPayoutNotes("");}}><CheckCircle2 className="mr-1 h-4 w-4"/>Confirmar pago</Button></div>
      {payingId===w.id&&<div className="w-full space-y-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
         <p className="text-sm font-bold">Confirmação da transferência manual de {money(Number(w.amount))}</p>
         <p className="text-xs text-muted-foreground">Informe a referência do comprovante somente após realizar a transferência bancária. Essa confirmação registra data, horário e administrador.</p>
         <Input placeholder="ID da transferência / referência do comprovante" value={receipt} maxLength={200} onChange={e=>setReceipt(e.target.value)}/>
         <Input placeholder="Observação (opcional)" value={payoutNotes} maxLength={1000} onChange={e=>setPayoutNotes(e.target.value)}/>
         <Button disabled={busy||receipt.trim().length<3} onClick={()=>void perform(async()=>{await finalize({data:{withdrawal_id:w.id,status:"paid",reference:receipt.trim(),notes:payoutNotes}});setPayingId(null);},"Transferência registrada; valor abatido.")}>Registrar como pago</Button>
       </div>}
    </div>;}):<p className="text-sm text-muted-foreground">Nenhum saque aguardando atendimento.</p>}</div>
   </CardContent></Card>
   <Card className="rounded-3xl"><CardContent className="p-6"><h2 className="text-lg font-bold">Histórico de saques</h2><div className="mt-4 space-y-2">{data.withdrawals.filter((w:any)=>["paid","rejected"].includes(w.status)).slice(0,80).map((w:any)=>{const a=data.affiliates.find((x:any)=>x.establishment_id===w.establishment_id);return <div key={w.id} className="grid gap-2 border-b py-3 text-sm sm:grid-cols-4"><span className="font-semibold">{a?.establishments?.name||"Afiliado"}</span><span>{money(Number(w.amount))} · {w.status==="paid"?"Pago":"Rejeitado"}</span><span>{w.processed_at?dateTime(w.processed_at):"—"}</span><span className="break-all text-xs text-muted-foreground">Responsável: {data.processorNames?.[w.processed_by]||w.processed_by||"—"}<br/>Referência: {w.proof_reference||"—"}</span></div>})}</div>
   </CardContent></Card>
   <p className="text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>Transações usam a confirmação da assinatura paga, não métricas de clique ou cadastro. Os saques são conciliados manualmente.</p>
 </div>;
}
