/**
 * Evolution API (WhatsApp) istemcisi. whatsapp-ai-asistan'dan çıkarıldı.
 * Ortam değişkenine bağlı değil: ayarları siz verirsiniz.
 *
 *   const wa = createEvolutionClient({ url: process.env.EVOLUTION_API_URL!, apiKey: process.env.EVOLUTION_API_KEY!, instance: "magaza" });
 *   await wa.sendText("905551112233@s.whatsapp.net", "Merhaba!");
 */
export type EvolutionConfig = { url: string; apiKey: string; instance: string };

export function createEvolutionClient(cfg: EvolutionConfig) {
  const base = cfg.url.replace(/\/+$/, "");
  const inst = encodeURIComponent(cfg.instance);
  if (!base || !cfg.apiKey || !cfg.instance) throw new Error("Evolution API ayarları eksik");

  async function call(path: string, init?: RequestInit) {
    const res = await fetch(base + path, {
      ...init,
      headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Evolution API ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    /** Mesajı gönderir, WhatsApp mesaj kimliğini döndürür. */
    async sendText(jidOrPhone: string, text: string): Promise<string | null> {
      const data = await call(`/message/sendText/${inst}`, {
        method: "POST",
        body: JSON.stringify({ number: jidOrPhone, text }),
      });
      return data?.key?.id ?? null;
    },
    /** "open" = bağlı, "connecting", "close" … */
    async connectionState(): Promise<string> {
      const data = await call(`/instance/connectionState/${inst}`);
      return data?.instance?.state ?? "unknown";
    },
    /** Eşleştirme için QR kodu (data URL); zaten bağlıysa null. */
    async connectQr(): Promise<string | null> {
      const data = await call(`/instance/connect/${inst}`);
      return data?.base64 ?? null;
    },
    /** Gelen mesajları webhook adresinize yollatır. Gizli anahtar başlıkta taşınır, sunucu kayıtlarına düşmez. */
    setWebhook(webhookUrl: string, secret: string, events: string[] = ["MESSAGES_UPSERT"]) {
      return call(`/webhook/set/${inst}`, {
        method: "POST",
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            headers: { "x-webhook-secret": secret },
            webhookByEvents: false,
            webhookBase64: false,
            events,
          },
        }),
      });
    },
  };
}
