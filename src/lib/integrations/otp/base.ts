import type { IntegrationRuntimeConfig, NodeEnv, TestConnectionResult } from "../types";
import type { IntegrationProvider } from "../types";

export interface WhatsAppInstanceStatus {
  status: "CONNECTED" | "DISCONNECTED" | "QRCODE" | "CONNECTING" | "ERROR";
  qrcode?: string;
  pairingCode?: string;
  instanceName?: string;
  owner?: string;
  updatedAt: string;
}

export interface WhatsAppOTPProvider extends IntegrationProvider {
  sendOtp(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, code: string): Promise<{ ok: boolean; message: string }>;
  sendTestMessage(runtime: IntegrationRuntimeConfig, env: NodeEnv, phone: string, message: string, options?: any): Promise<{ ok: boolean; message: string; providerMessageId?: string; providerResponse?: any; httpStatus?: number }>;
  
  /** 
   * WhatsApp Instance Management 
   */
  getInstanceStatus(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<WhatsAppInstanceStatus>;
  disconnectInstance(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<{ ok: boolean; message: string }>;
  
  /** Normaliza o payload de entrada do webhook para o formato interno */
  parseWebhook?(
    body: any,
    headers: Record<string, string>
  ): {
    remoteMessageId: string;
    fromPhone: string;
    /** WhatsApp PN or LID JID used for replies. */
    replyJid?: string;
    text: string;
    messageType?: string;
    mediaUrl?: string;
    pushName?: string;
  } | null;
}
