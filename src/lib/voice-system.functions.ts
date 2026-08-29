import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public/Merchant access: Obtém a configuração global da ElevenLabs se estiver ativa.
 * A API Key é mantida no servidor; esta função retorna apenas se está configurada.
 * Utiliza a tabela system_settings para configurações globais da plataforma.
 */
export const getGlobalVoiceConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data, error } = await (supabaseAdmin as any)
      .from("system_settings")
      .select("value, enabled")
      .eq("namespace", "voice")
      .eq("key", "elevenlabs")
      .maybeSingle();

    if (error || !data || !data.enabled) return { isConfigured: false };
    
    const config = data.value as any;
    if (!config || !config.apiKey) return { isConfigured: false };

    return {
      isConfigured: true,
      voiceId: config.voiceId,
      modelId: config.modelId,
      stability: config.stability,
      similarity: config.similarity,
      texts: config.texts || {}
    };
  });

/**
 * Server-only synthesis using global system credentials from system_settings.
 */
export const synthesizeGlobalEleven = createServerFn({ method: "POST" })
  .validator(z.object({
    text: z.string(),
    event: z.string().optional()
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Get Global Config from system_settings
    const { data: settings } = await (supabaseAdmin as any)
      .from("system_settings")
      .select("value, enabled")
      .eq("namespace", "voice")
      .eq("key", "elevenlabs")
      .maybeSingle();
    
    if (!settings || !settings.enabled) {
      throw new Error("ElevenLabs global não configurada ou desativada.");
    }

    const config = settings.value as any;
    if (!config || !config.apiKey) {
      throw new Error("ElevenLabs global: chave de API não configurada.");
    }

    // Decrypt API Key before use using robust AES-256-GCM.
    // Falha de descriptografia não pode derrubar a UI: retornamos um aviso.
    const encryptedKey = config.apiKey;
    let apiKey = encryptedKey;
    if (encryptedKey) {
      const { decryptSecret } = await import("./integrations/crypt.server");
      try {
        apiKey = await decryptSecret(encryptedKey);
      } catch (err) {
        console.error("Voice: falha ao descriptografar a chave ElevenLabs.", err);
        return {
          audio: null,
          error:
            "A chave da ElevenLabs foi salva com outra chave de criptografia. Regrave-a no Voice Studio / painel de integrações.",
        };
      }
    }


    // Process template if event is provided
    let textToSpeak = data.text;
    if (data.event && config.texts?.[data.event]) {
      textToSpeak = config.texts[data.event];
    }

    // 2. Call ElevenLabs API
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textToSpeak,
        model_id: config.modelId || "eleven_multilingual_v2",
        voice_settings: {
          stability: config.stability ?? 0.5,
          similarity_boost: config.similarity ?? 0.75,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail?.message || `Erro ElevenLabs: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      audio: base64,
      mime: "audio/mpeg",
    };
  });
