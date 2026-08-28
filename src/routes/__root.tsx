import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getSeoMetadata } from "../lib/seo-utils.server";

const getSeoMetadataFn = createServerFn({ method: "GET" })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    try {
      return await getSeoMetadata(data);
    } catch (e) {
      console.error("[getSeoMetadataFn] Error:", e);
      return {
        title: "Afidelize",
        meta: [{ name: "description", content: "Cartão fidelidade digital." }],
        links: [],
      } as Awaited<ReturnType<typeof getSeoMetadata>>;
    }
  });


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initSentryClient, captureClientError } from "../lib/sentry-client";
import { registerPWA } from "../lib/pwa-register";
import { supabase } from "@/integrations/supabase/client";
import { startSessionKeeper } from "../lib/session-keeper";
import { Toaster } from "@/components/ui/sonner";
import { MetaPixel } from "@/components/MetaPixel";
import { ScrollLockGuard } from "@/components/ScrollLockGuard";
import { toast } from "sonner";


const AUTH_SYNC_CHANNEL = "fidelize-auth-sync";


if (typeof window !== "undefined") {
  initSentryClient();
  registerPWA();
  startSessionKeeper();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">O endereço que você tentou acessar não existe.</p>
        <div className="mt-6">
          <Link to="/auth" className="inline-flex items-center justify-center rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">Voltar ao início</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[root errorComponent]", error);
    reportLovableError(error, { boundary: "root" });
    captureClientError(error, { boundary: "root" });
  }, [error]);
  const detail = (error && (error.message || String(error))) || "";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Ops, algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p>
        {detail ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-md border bg-muted/40 px-3 py-2 text-left text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">
            {detail}
          </pre>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button>
          <a href="/auth" className="rounded-md border px-4 py-2 text-sm font-medium">Início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ location }) => {
    return getSeoMetadataFn({ data: location.pathname });
  },
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<ReturnType<typeof getSeoMetadata>>;
    const seoLinks = data.links ?? [];
    
    return {
      title: data.title,
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...data.meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        ...seoLinks.filter(link => 
          !(link.rel === "stylesheet" && link.href === appCss)
        ),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Tema padrão do sistema: CLARO em todas as rotas.
// O usuário pode alternar (hero, painel lojista, admin) e a escolha é respeitada.
function forcedThemeForPath(_p: string): "dark" | null {
  return null;
}
const THEME_INIT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem('theme');}catch(_){}var t=(s==='light'||s==='dark')?s:'light';var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;}catch(e){}})();`;





function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(AUTH_SYNC_CHANNEL) : null;

    // Só invalida o cache quando a IDENTIDADE muda de fato.
    // Antes, qualquer renovação de token / heartbeat de sessão limpava todo o
    // cache e fazia a interface inteira piscar.
    const syncIdentity = (userId: string | null) => {
      if (lastUserId.current === undefined) { lastUserId.current = userId; return false; }
      if (lastUserId.current === userId) return false;
      lastUserId.current = userId;
      router.invalidate();
      if (userId) queryClient.invalidateQueries();
      return true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        const changed = syncIdentity(session?.user?.id ?? null);
        if (changed) { try { bc?.postMessage({ type: event, at: Date.now() }); } catch { /* noop */ } }
      }
    });

    const revalidateFromOtherTab = async () => {
      const { data } = await supabase.auth.getSession();
      syncIdentity(data.session?.user?.id ?? null);
    };

    const onMsg = (ev: MessageEvent) => {
      const t = ev.data?.type;
      if (t === "SIGNED_IN" || t === "SIGNED_OUT" || t === "USER_UPDATED") void revalidateFromOtherTab();
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "fidelize:last-auth-sync" || ev.key === "fidelize:last-manual-session-sync") {
        void revalidateFromOtherTab();
      }
    };
    bc?.addEventListener("message", onMsg);
    window.addEventListener("storage", onStorage);
    return () => { subscription.unsubscribe(); bc?.removeEventListener("message", onMsg); bc?.close(); window.removeEventListener("storage", onStorage); };
  }, [router, queryClient]);

  useEffect(() => {
    const apply = () => {
      const forced = forcedThemeForPath(window.location.pathname);
      const fallback: "light" | "dark" = "light";
      let t: "light" | "dark" = fallback;
      if (forced) t = forced;
      else {
        const s = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
        t = s === "light" || s === "dark" ? s : fallback;
      }
      const r = document.documentElement;
      r.classList.toggle("dark", t === "dark");
      r.style.colorScheme = t;
      // Mantém a barra do navegador/PWA na cor do tema atual (claro por padrão).
      const meta = document.querySelector('meta[name="theme-color"]:not([media])');
      if (meta) meta.setAttribute("content", t === "dark" ? "#0a0f1c" : "#ffffff");
    };

    apply();
    const unsub = router.subscribe("onResolved", apply);
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        payload?: { title?: string; body?: string; error?: string };
      } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "fidelize:push-received") {
        const title = data.payload?.title || "Notificação recebida";
        const body = data.payload?.body;
        toast.message(title, body ? { description: body } : undefined);
      }
      if (data.type === "fidelize:push-display-failed") {
        toast.error("O navegador recebeu o push, mas bloqueou a exibição do alerta.");
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let lastSync = 0;
    const syncVisibleData = async () => {
      const now = Date.now();
      if (now - lastSync < 2500) return;
      lastSync = now;
      router.invalidate();
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          queryClient.invalidateQueries({ refetchType: "active" });
        }
      } catch {
        /* a sincronização não pode quebrar a navegação */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncVisibleData();
    };
    const onPageShow = () => void syncVisibleData();
    window.addEventListener("focus", onPageShow);
    window.addEventListener("online", onPageShow);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onPageShow);
      window.removeEventListener("online", onPageShow);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, queryClient]);





  return (
    <QueryClientProvider client={queryClient}>
      <ScrollLockGuard />
      <Outlet />
      <MetaPixel />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
