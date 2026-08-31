import { jsPDF } from "jspdf";

type Item = {
  id: string;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  price: number | null;
  promo_price: number | null;
  currency: string;
  image_url: string | null;
  badges: any;
  category_id: string | null;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  featured?: boolean | null;
};

type MenuData = {
  establishment: {
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
  menu: {
    display_name: string | null;
    tagline: string | null;
  } | null;
  categories: Category[];
  items: Item[];
};

const BADGE_LABEL: Record<string, string> = {
  vegetariano: "Vegetariano",
  vegano: "Vegano",
  sem_gluten: "Sem gluten",
  sem_lactose: "Sem lactose",
  picante: "Picante",
  carne: "Carne",
  frutos_mar: "Frutos do mar",
  contem_ovos: "Contem ovos",
  contem_castanhas: "Castanhas",
};

function fmt(v: number | null, currency = "BRL"): string {
  if (v == null) return "";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `R$ ${v.toFixed(2)}`;
  }
}

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const h = (hex || "#B8371D").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

async function fetchImageDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = data;
    });
    return { data, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export async function generateMenuPdf(data: MenuData, slug: string): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentW = pageW - marginX * 2;

  const [pr, pg, pb] = hexToRgb(data.establishment.primary_color);
  const ink: [number, number, number] = [23, 19, 14];
  const muted: [number, number, number] = [110, 100, 90];
  const paper: [number, number, number] = [251, 247, 240];

  // ---------- COVER ----------
  doc.setFillColor(...paper);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFillColor(...ink);
  doc.rect(0, 68, pageW, 2, "F");

  const logo = data.establishment.logo_url
    ? await fetchImageDataUrl(data.establishment.logo_url)
    : null;
  if (logo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(marginX, 22, 32, 32, 3, 3, "F");
      doc.addImage(logo.data, "PNG", marginX + 2, 24, 28, 28, undefined, "FAST");
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  const titleX = logo ? marginX + 38 : marginX;
  doc.text(data.establishment.name, titleX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const sub =
    data.menu?.tagline || data.establishment.description || "Cardapio digital";
  doc.text(doc.splitTextToSize(sub, contentW - (titleX - marginX)), titleX, 50);

  // Establishment info bar
  let y = 82;
  doc.setTextColor(...muted);
  doc.setFontSize(9);
  const infoBits: string[] = [];
  if (data.establishment.address) infoBits.push(data.establishment.address);
  if (data.establishment.phone) infoBits.push(`Tel: ${data.establishment.phone}`);
  if (data.establishment.whatsapp) infoBits.push(`WhatsApp: ${data.establishment.whatsapp}`);
  if (data.establishment.instagram) infoBits.push(`@${data.establishment.instagram.replace(/^@/, "")}`);
  if (infoBits.length) {
    doc.text(doc.splitTextToSize(infoBits.join("  ·  "), contentW), marginX, y);
    y += 6;
  }
  y += 4;

  // ---------- ITEMS ----------
  const uncat: Category = { id: "__uncat", name: "Outros", description: null };
  const cats = [...data.categories, uncat];
  const itemsByCat = new Map<string, Item[]>();
  for (const c of cats) itemsByCat.set(c.id, []);
  for (const it of data.items) {
    const k = it.category_id ?? "__uncat";
    if (!itemsByCat.has(k)) itemsByCat.set(k, []);
    itemsByCat.get(k)!.push(it);
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 20) {
      addFooter();
      doc.addPage();
      doc.setFillColor(...paper);
      doc.rect(0, 0, pageW, pageH, "F");
      y = 20;
    }
  };

  const addFooter = () => {
    const page = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${data.establishment.name} · afidelize.app/cardapio/${slug}`,
      marginX,
      pageH - 8,
    );
    doc.text(String(page), pageW - marginX, pageH - 8, { align: "right" });
  };

  for (const c of cats) {
    const list = itemsByCat.get(c.id) || [];
    if (list.length === 0) continue;

    ensureSpace(18);
    // Category header
    doc.setFillColor(pr, pg, pb);
    doc.rect(marginX, y, 3, 8, "F");
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(c.name.toUpperCase(), marginX + 6, y + 6.2);
    y += 10;
    if (c.description) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      const lines = doc.splitTextToSize(c.description, contentW);
      doc.text(lines, marginX, y);
      y += lines.length * 4 + 2;
    }
    // Divider
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5;

    for (const it of list) {
      const priceStr = it.promo_price != null ? fmt(it.promo_price, it.currency) : fmt(it.price, it.currency);
      const oldPriceStr =
        it.promo_price != null && it.price != null && it.promo_price < it.price
          ? fmt(it.price, it.currency)
          : "";

      // Compute needed height
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const nameLines = doc.splitTextToSize(it.name, contentW - 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const desc = it.short_desc || it.long_desc || "";
      const descLines = desc ? doc.splitTextToSize(desc, contentW - 30) : [];
      const badges: string[] = Array.isArray(it.badges)
        ? (it.badges as string[]).map((b) => BADGE_LABEL[b]).filter(Boolean)
        : [];
      const badgeLine = badges.length ? badges.join("  ·  ") : "";
      const blockH = 6 + nameLines.length * 4.5 + descLines.length * 4 + (badgeLine ? 5 : 0) + 4;

      ensureSpace(blockH);

      // Name + price on same row
      doc.setTextColor(...ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(nameLines, marginX, y);
      const priceY = y;
      doc.setTextColor(pr, pg, pb);
      doc.text(priceStr, pageW - marginX, priceY, { align: "right" });
      if (oldPriceStr) {
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        const pw = doc.getTextWidth(priceStr);
        doc.text(oldPriceStr, pageW - marginX - pw - 3, priceY, { align: "right" });
      }
      y += nameLines.length * 4.5 + 1;

      if (descLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.text(descLines, marginX, y);
        y += descLines.length * 4 + 1;
      }

      if (badgeLine) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(pr, pg, pb);
        doc.text(badgeLine, marginX, y);
        y += 4;
      }

      // dotted separator
      doc.setDrawColor(200, 190, 175);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([0.6, 0.9], 0);
      doc.line(marginX, y + 1, pageW - marginX, y + 1);
      doc.setLineDashPattern([], 0);
      y += 5;
    }

    y += 4;
  }

  addFooter();

  const filename = `cardapio-${slug}.pdf`;
  doc.save(filename);
}
