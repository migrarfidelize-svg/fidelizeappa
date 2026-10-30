import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Link2, Share2, Wallet, Users, TrendingUp, Clock3, Upload, Image, Film, ArrowUpRight, ShieldCheck } from "lucide-react";
import { getAffiliateDashboard, updateAffiliateProfile, requestAffiliateWithdrawal, saveAffiliateAsset } from "@/lib/affiliate.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RouteLoading } from "@/components/RouteLoading";

export const Route = createFileRoute("/_authenticated/app/afiliados")({ component: AffiliateMerchantPage });
const brl = (n:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(n||0);
const dt = (s:string) => new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
function Stat({label,value,icon:Icon,detail}:{label:string;value:string;icon:any;detail?:string}) {
  return <div className="rounded-3xl border border-white/10 bg-white/[.04] p-5">
    <div className="mb-5 flex items-center justify-between"><span className="text-sm text-white/55">{label}</span><Icon className="h-5 w-5 text-violet-300"/></div>
    <div className="text-3xl font-black tracking-tight text-white">{value}</div>{detail&&<p className="mt-2 text-xs text-white/40">{detail}</p>}
  </div>;
}
function AffiliateMerchantPage(){
  const get = useServerFn(getAffiliateDashboard);
  const save = useServerFn(updateAffiliateProfile);
  const withdraw = useServerFn(requestAffiliateWithdrawal);
  const saveAsset = useServerFn(saveAffiliateAsset);
  const qc=useQueryClient();
  const {data,isLoading,error}=useQuery({queryKey:["affiliate-my-dashboard"],queryFn:()=>get()});
  const [code,setCode]=useState("");
  const [title,setTitle]=useState("");
  const [amount,setAmount]=useState("");
  const [pix,setPix]=useState("");
  const [format,setFormat]=useState<"feed"|"story"|"reels"|"square"|"landscape">("story");
  const [uploading,setUploading]=useState(false);
  const [busy,setBusy]=useState(false);
  const acc=data?.account;
  const activeCode=code || acc?.code || "";
  const link=activeCode ? `https://afidelize.app/?ref=${encodeURIComponent(activeCode)}`:"";
  const refresh=()=>qc.invalidateQueries({queryKey:["affiliate-my-dashboard"]});
  async function handleSave(){
    if(!data)return;setBusy(true);
    try{await save({data:{establishment_id:data.establishmentId,code:activeCode,title:title||acc?.custom_title||""}});toast.success("Link personalizado atualizado.");await refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível salvar.");}
    finally{setBusy(false);}
  }
  async function handleWithdrawal(){
    if(!data)return;const v=Number(amount.replace(",","."));
    if(!Number.isFinite(v)||v<=0){toast.error("Informe um valor válido.");return;}
    setBusy(true);
    try{await withdraw({data:{establishment_id:data.establishmentId,amount:Math.round(v*100)/100,pix_key:pix.trim()}});
      setAmount("");toast.success("Solicitação enviada para análise manual do administrador.");await refresh();}
    catch(e){toast.error(e instanceof Error?e.message:"Não foi possível solicitar o saque.");}
    finally{setBusy(false);}
  }
  async function handleAsset(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file||!data)return;
    const isImage=/^image\/(png|jpeg|webp)$/.test(file.type);
    const isVideo=/^video\/(mp4|webm|quicktime)$/.test(file.type);
    if(!isImage&&!isVideo){toast.error("Aceitamos JPG, PNG, WEBP, MP4, MOV e WEBM.");return;}
    if(file.size>(isImage?5:50)*1024*1024){toast.error(isImage?"Máximo de 5 MB por imagem.":"Máximo de 50 MB por vídeo.");return;}
    setUploading(true);
    try{
      const bucket=isImage?"logos":"menu-videos";
      const path=isImage?`${(await supabase.auth.getUser()).data.user?.id}/affiliates/${data.establishmentId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()||"jpg"}`
        :`est_${data.establishmentId}/affiliates/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()||"mp4"}`;
      const upload=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
      if(upload.error)throw upload.error;
      const url=supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      await saveAsset({data:{establishment_id:data.establishmentId,media_url:url,media_type:isImage?"image":"video",format,title:file.name.slice(0,90)}});
      toast.success("Criativo adicionado à biblioteca.");await refresh();
    }catch(e){toast.error(e instanceof Error?e.message:"Erro ao enviar arquivo.");}
    finally{setUploading(false);event.target.value="";}
  }
  if(isLoading)return <RouteLoading label="Carregando sua área de afiliados…" fullscreen={false} className="min-h-[50vh]"/>;
  if(error)return <div className="p-8 text-destructive">Não foi possível carregar afiliados: {String(error)}</div>;
  if(!data)return null;
  return <div className="space-y-6 p-3 sm:p-6 lg:p-8">
    <section className="relative overflow-hidden rounded-[2rem] border border-violet-500/20 bg-[#0d0920] p-6 text-white sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl"/>
      <div className="relative max-w-2xl">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[.25em] text-violet-300">Fidelize Partners</p>
        <h1 className="text-3xl font-black sm:text-5xl">Indique. Converta.<br/><span className="text-violet-300">Ganhe por vendas.</span></h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">Compartilhe seu link exclusivo. Cadastros são acompanhados, mas só a primeira compra aprovada de um plano gera comissão. Saques são realizados manualmente após a confirmação do administrador.</p>
      </div>
      <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Cadastros indicados" value={String(data.registrations)} icon={Users} detail="Ainda não são comissões"/>
        <Stat label="Vendas válidas" value={String(data.purchases)} icon={TrendingUp}/>
        <Stat label="Saldo disponível" value={brl(data.balance.available)} icon={Wallet} detail="Descontadas as solicitações e saques"/>
        <Stat label="Aguardando liberação" value={brl(data.balance.pending)} icon={Clock3}/>
      </div>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="rounded-3xl"><CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-violet-500"/><h2 className="text-lg font-bold">Seu link exclusivo</h2></div>
        <p className="text-sm text-muted-foreground">Escolha seu identificador para divulgar a Fidelize.</p>
        <div className="grid gap-2"><label className="text-xs font-bold">Identificador</label><Input value={activeCode} onChange={e=>setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,""))} maxLength={40}/></div>
        <div className="rounded-xl border bg-muted/30 p-3 text-xs break-all">{link}</div>
        <div className="flex flex-wrap gap-2"><Button onClick={handleSave} disabled={busy}>Salvar personalização</Button><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(link);toast.success("Link copiado!");}catch{toast.error("Não foi possível copiar.");}}}><Copy className="mr-2 h-4 w-4"/>Copiar</Button><Button variant="outline" onClick={()=>{if(navigator.share)void navigator.share({url:link,title:"Conheça a Fidelize"});else void navigator.clipboard.writeText(link);}}><Share2 className="mr-2 h-4 w-4"/>Compartilhar</Button></div>
      </CardContent></Card>
      <Card className="rounded-3xl"><CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-violet-500"/><h2 className="text-lg font-bold">Solicitar saque</h2></div>
        <p className="text-sm text-muted-foreground">Disponível para solicitar: <strong>{brl(data.balance.available)}</strong>. A transferência é manual, feita pela equipe Fidelize.</p>
        <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-bold">Valor (R$)</label><Input value={amount} placeholder="0,00" inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></div><div><label className="text-xs font-bold">Chave Pix para recebimento</label><Input value={pix} onChange={e=>setPix(e.target.value)} placeholder="Sua chave Pix" maxLength={200}/></div></div>
        <Button disabled={busy||data.balance.available<=0||!pix.trim()} onClick={handleWithdrawal} className="w-full">Solicitar transferência <ArrowUpRight className="ml-2 h-4 w-4"/></Button>
        <p className="text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3 w-3"/>O valor solicitado fica reservado, evitando saques duplicados.</p>
      </CardContent></Card>
    </div>
    <Card className="rounded-3xl"><CardContent className="space-y-4 p-6">
      <h2 className="text-lg font-bold">Biblioteca de criativos</h2>
      <p className="text-sm text-muted-foreground">Envie sua própria imagem ou vídeo para divulgar o seu link. Escolha o formato: feed, stories, reels, quadrado ou horizontal.</p>
      <div className="flex flex-wrap items-center gap-3"><select value={format} onChange={e=>setFormat(e.target.value as typeof format)} className="h-10 rounded-xl border bg-background px-3 text-sm"><option value="story">Story 9:16</option><option value="reels">Reels 9:16</option><option value="feed">Feed 4:5</option><option value="square">Quadrado 1:1</option><option value="landscape">Horizontal 16:9</option></select>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/>{uploading?"Enviando…":"Adicionar criativo"}<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" disabled={uploading} onChange={handleAsset}/></label></div>
      {data.assets.length===0?<div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Seus criativos aparecerão aqui.</div>:<div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{data.assets.map((asset:any)=><a key={asset.id} href={asset.media_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border bg-muted/10"><div className="flex aspect-[4/3] items-center justify-center bg-muted">{asset.media_type==="image"?<img src={asset.media_url} alt={asset.title} className="h-full w-full object-cover"/>:<Film className="h-8 w-8 text-muted-foreground"/>}</div><p className="truncate p-3 text-xs">{asset.title||asset.format}</p></a>)}</div>}
    </CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="rounded-3xl"><CardContent className="p-6"><h2 className="mb-4 text-lg font-bold">Indicações recentes</h2><div className="space-y-3">{data.referrals.length?data.referrals.slice(0,20).map((r:any)=><div key={r.id} className="flex justify-between gap-3 border-b pb-3 text-sm"><div><p className="font-semibold">{r.establishments?.name||"Empresa indicada"}</p><p className="text-xs text-muted-foreground">{dt(r.registered_at)}</p></div><span className="text-xs text-muted-foreground">{data.commissions.some((c:any)=>c.referral_id===r.id&&c.status==="confirmed")?"Compra aprovada":"Aguardando compra"}</span></div>):<p className="text-sm text-muted-foreground">Nenhum cadastro indicado.</p>}</div></CardContent></Card>
      <Card className="rounded-3xl"><CardContent className="p-6"><h2 className="mb-4 text-lg font-bold">Histórico de saques</h2><div className="space-y-3">{data.withdrawals.length?data.withdrawals.map((w:any)=><div key={w.id} className="flex items-center justify-between gap-3 border-b pb-3"><div><p className="font-bold">{brl(Number(w.amount))}</p><p className="text-xs text-muted-foreground">Solicitado: {dt(w.requested_at)}{w.processed_at?" · Atendido: "+dt(w.processed_at):""}</p><p className="text-[11px] text-muted-foreground">{w.proof_reference&&"Referência: "+w.proof_reference}</p></div><span className="text-xs font-semibold">{({requested:"Em análise",processing:"Em pagamento",paid:"Pago",rejected:"Rejeitado"} as Record<string,string>)[w.status]||w.status}</span></div>):<p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>}</div></CardContent></Card>
    </div>
    <p className="text-xs text-muted-foreground">Comissões referentes à primeira contratação confirmada de cada indicado. Pagamentos estornados não geram saldo. A liquidação financeira depende de confirmação administrativa.</p>
  </div>;
}
