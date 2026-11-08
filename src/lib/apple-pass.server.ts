// Monta o pass.json (storeCard) do Apple Wallet a partir do modelo compartilhado.
// Server-only.
import { type WalletPassModel, tierLabel, hexToRgbCss } from "@/lib/wallet-pass.server";
import { getProximityLocations } from "@/lib/wallet-proximity";

export function buildApplePassJson(args: {
  model: WalletPassModel;
  origin: string;
  passTypeId: string;
  teamId: string;
  serialNumber: string;
  authenticationToken: string;
}): Record<string, unknown> {
  const { model, origin, serialNumber, authenticationToken } = args;
  const s = model.settings;
  const f = s.fields;
  const cardUrl = `${origin}/c/${model.customer.access_token}`;
  const places = getProximityLocations(s);

  const primaryFields = model.card && f.stamps
    ? [{ key: "stamps", label: "Carimbos", value: `${model.card.stamps}/${model.card.stamps_required}` }]
    : f.points
      ? [{ key: "points", label: "Pontos", value: String(model.points) }]
      : [];

  const secondaryFields = [
    ...(f.customer ? [{ key: "customer", label: "Cliente", value: model.customer.name }] : []),
    ...(f.code ? [{ key: "code", label: "Cartão", value: model.customer.code }] : []),
  ];

  const auxiliaryFields = [
    ...(f.tier ? [{ key: "tier", label: "Nível", value: tierLabel(model.customer.tier) }] : []),
    ...(f.points && model.card && f.stamps ? [{ key: "points", label: "Pontos", value: String(model.points) }] : []),
    ...(f.reward && model.card ? [{ key: "reward", label: "Recompensa", value: model.card.reward_title }] : []),
  ];

  const backFields = [
    ...(s.back_text ? [{ key: "back", label: "Informações", value: s.back_text }] : []),
    ...(s.custom_message ? [{ key: "message", label: "Mensagem", value: s.custom_message }] : []),
    ...(f.contact && model.establishment.phone ? [{ key: "phone", label: "Telefone", value: model.establishment.phone }] : []),
    ...(f.contact && model.establishment.whatsapp ? [{ key: "whatsapp", label: "WhatsApp", value: model.establishment.whatsapp }] : []),
    ...(f.contact && model.establishment.address ? [{ key: "address", label: "Endereço", value: model.establishment.address }] : []),
    { key: "url", label: "Ver online", value: cardUrl },
  ];

  const barcodes: Array<Record<string, string>> = [];
  if (s.show_qr) {
    barcodes.push({ format: "PKBarcodeFormatQR", message: cardUrl, messageEncoding: "iso-8859-1", altText: model.customer.code });
  }
  if (s.show_barcode) {
    barcodes.push({ format: "PKBarcodeFormatCode128", message: model.customer.code, messageEncoding: "iso-8859-1", altText: model.customer.code });
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: args.passTypeId,
    teamIdentifier: args.teamId,
    organizationName: model.establishment.name,
    description: s.front_text || `Cartão fidelidade ${model.establishment.name}`,
    serialNumber,
    authenticationToken,
    webServiceURL: `${origin}/api/public/wallet/v1`,
    backgroundColor: hexToRgbCss(s.background_color, hexToRgbCss(model.establishment.primary_color, "rgb(91,33,182)")),
    foregroundColor: hexToRgbCss(s.foreground_color, "rgb(255,255,255)"),
    labelColor: hexToRgbCss(s.label_color, "rgb(233,213,255)"),
    logoText: model.establishment.name,
    ...(places.length ? {
      locations: places.map((location) => ({
        ...location,
        relevantText: s.proximity_message?.trim() || `Seu cartão de ${model.establishment.name} está aqui!`,
      })),
    } : {}),
    ...(f.expiry && model.expiresAt ? { expirationDate: new Date(model.expiresAt).toISOString() } : {}),
    ...(barcodes.length ? { barcodes, barcode: barcodes[0] } : {}),
    storeCard: {
      headerFields: model.card ? [{ key: "campaign", label: "Campanha", value: model.card.campaign_name }] : [],
      primaryFields,
      secondaryFields,
      auxiliaryFields,
      backFields,
    },
  };
}
