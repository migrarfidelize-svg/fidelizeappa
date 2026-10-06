import { useCallback, useEffect, useState } from "react";

export type CartLine = { id: string; qty: number; variant?: string | null };

const key = (slug: string) => `fidelize:cart:${slug}`;
const CART_EVENT = "fidelize:cart:update";

/** Chave única de uma linha (produto + variação escolhida). */
export const lineKey = (id: string, variant?: string | null) => `${id}::${variant ?? ""}`;

function readCart(slug: string): CartLine[] {
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Carrinho simples da vitrine pública, persistido no navegador do cliente. */
export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(readCart(slug));

    const sync = (event: Event) => {
      const custom = event as CustomEvent<{ slug?: string; lines?: CartLine[] }>;
      if (custom.detail?.slug && custom.detail.slug !== slug) return;
      setLines(custom.detail?.lines ?? readCart(slug));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === key(slug)) setLines(readCart(slug));
    };

    window.addEventListener(CART_EVENT, sync as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CART_EVENT, sync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [slug]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      try {
        localStorage.setItem(key(slug), JSON.stringify(next));
      } catch {
        /* ignora */
      }
      window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { slug, lines: next } }));
    },
    [slug],
  );

  const add = useCallback(
    (id: string, qty = 1, variant?: string | null) => {
      const k = lineKey(id, variant);
      const cur = lines.find((l) => lineKey(l.id, l.variant) === k);
      persist(
        cur
          ? lines.map((l) =>
              lineKey(l.id, l.variant) === k ? { ...l, qty: Math.min(99, l.qty + qty) } : l,
            )
          : [...lines, { id, qty, variant: variant ?? null }],
      );
    },
    [lines, persist],
  );

  const setQty = useCallback(
    (id: string, qty: number, variant?: string | null) => {
      const k = lineKey(id, variant);
      persist(
        qty <= 0
          ? lines.filter((l) => lineKey(l.id, l.variant) !== k)
          : lines.map((l) => (lineKey(l.id, l.variant) === k ? { ...l, qty } : l)),
      );
    },
    [lines, persist],
  );

  const remove = useCallback((id: string, variant?: string | null) => setQty(id, 0, variant), [setQty]);
  const clear = useCallback(() => persist([]), [persist]);
  const qtyOf = useCallback(
    (id: string, variant?: string | null) => {
      if (variant === undefined) {
        return lines.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);
      }
      const k = lineKey(id, variant);
      return lines.find((l) => lineKey(l.id, l.variant) === k)?.qty ?? 0;
    },
    [lines],
  );
  const count = lines.reduce((a, l) => a + l.qty, 0);

  return { lines, add, setQty, remove, clear, qtyOf, count };
}
