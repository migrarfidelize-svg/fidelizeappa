/**
 * Push silencioso de atualização para passes Apple Wallet já instalados.
 * O payload não contém marketing: apenas avisa o iPhone para buscar o passe.
 * Servidor Node/VPS. Certificado P12 permanece exclusivamente no servidor.
 */
export async function notifyAppleWalletPass(passId: string): Promise<{ sent: number; devices: number }> {
  const { readAppleCreds } = await import("@/lib/pkpass.server");
  const creds = readAppleCreds();
  if (!creds) return { sent: 0, devices: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wallet_pass_devices")
    .select("push_token")
    .eq("pass_id", passId)
    .limit(200);
  if (error) throw error;

  const tokens = [...new Set((data ?? [])
    .map((d) => d.push_token)
    .filter((token): token is string => typeof token === "string" && /^[a-f0-9]{32,}$/i.test(token)))];
  if (tokens.length === 0) return { sent: 0, devices: 0 };

  const http2 = await import("node:http2");
  const session = http2.connect("https://api.push.apple.com", {
    pfx: Buffer.from(creds.p12Base64, "base64"),
    passphrase: creds.p12Password,
  });
  // O HTTP/2 emite erro assíncrono mesmo quando a requisição falha.
  session.on("error", () => { /* cada stream retorna falha de forma controlada */ });

  const send = async (token: string): Promise<boolean> => new Promise((resolve) => {
    try {
      const request = session.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        "apns-topic": creds.passTypeId,
        "apns-push-type": "background",
        "apns-priority": "5",
        "content-type": "application/json",
      });
      let status = 0;
      let finished = false;
      const complete = (ok: boolean) => {
        if (finished) return;
        finished = true;
        resolve(ok);
      };
      request.on("response", (headers) => { status = Number(headers[":status"] ?? 0); });
      request.on("data", () => { /* consumir corpo sem registrar token ou dados sensíveis */ });
      request.on("end", () => complete(status === 200));
      request.on("error", () => complete(false));
      request.on("close", () => complete(status === 200));
      request.setTimeout(10000, () => { request.close(); complete(false); });
      request.end("{}");
    } catch {
      resolve(false);
    }
  });

  let sent = 0;
  try {
    // Não saturar APNs com diversos dispositivos por cliente.
    for (let i = 0; i < tokens.length; i += 5) {
      const results = await Promise.all(tokens.slice(i, i + 5).map(send));
      sent += results.filter(Boolean).length;
    }
  } finally {
    session.close();
  }
  return { sent, devices: tokens.length };
}
