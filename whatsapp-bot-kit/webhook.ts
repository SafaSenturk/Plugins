/**
 * Evolution webhook'undan gelen isteği güvenle okumak. Çatıdan bağımsız
 * (Next.js, Express, Hono…): başlığı ve JSON gövdeyi siz verirsiniz.
 */
import { timingSafeEqual } from "node:crypto";

export type IncomingMessage = {
  jid: string;          // cevap gönderirken kullanılacak adres
  phone: string;        // yalnızca rakamlar
  name: string | null;  // WhatsApp'taki görünen ad
  text: string;
  waMessageId: string;  // aynı mesaj iki kez gelirse ayırt etmek için
  fromMe: boolean;      // telefondan sizin yazdığınız mesajlar
};

export type ParseResult = { ok: true; message: IncomingMessage } | { ok: false; ignored: "event" | "source" | "non-text" };

/** x-webhook-secret başlığını sabit sürede karşılaştırır. Beklenen boşsa her isteği reddeder. */
export function verifySecret(given: string | null | undefined, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(message: any): string | null {
  if (!message) return null;
  return message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? message.videoMessage?.caption ?? null;
}

/** Grup, yayın ve yazısız mesajları ayıklar; birebir yazışmayı IncomingMessage'a çevirir. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEvolutionWebhook(payload: any): ParseResult {
  const event = String(payload?.event ?? "").toLowerCase().replace("_", ".");
  if (event !== "messages.upsert") return { ok: false, ignored: "event" };

  const data = payload.data;
  const key = data?.key;
  // Yeni WhatsApp sürümlerinde remoteJid "@lid" olabilir; gerçek numara alt alanlarda gelir.
  const remote: string = key?.remoteJid ?? "";
  const jid: string = remote.endsWith("@lid") ? (key?.remoteJidAlt ?? key?.senderPn ?? remote) : remote;
  if (!key?.id || !jid || jid.endsWith("@g.us") || jid.includes("broadcast")) return { ok: false, ignored: "source" };

  const text = extractText(data.message)?.trim();
  if (!text) return { ok: false, ignored: "non-text" };

  return {
    ok: true,
    message: {
      jid,
      phone: jid.split("@")[0].split(":")[0],
      name: data.pushName ?? null,
      text,
      waMessageId: key.id,
      fromMe: Boolean(key.fromMe),
    },
  };
}

/** "insan, şikayet, iade" gibi virgüllü listeden biri mesajda geçiyor mu (Türkçe büyük/küçük harf). */
export function matchesKeyword(text: string, keywords: string): boolean {
  const lower = text.toLocaleLowerCase("tr");
  return keywords.split(",").map((k) => k.trim().toLocaleLowerCase("tr")).filter(Boolean).some((k) => lower.includes(k));
}

/** Deneme modu: liste doluysa yalnızca bu numaralara cevap verilir. "0555 111 22 33, 905551112244" */
export function allowedByTestList(phone: string, list: string): boolean {
  const nums = list.split(",").map((n) => n.replace(/\D/g, "").replace(/^0+/, "")).filter((n) => n.length >= 10);
  return !nums.length || nums.some((n) => phone.endsWith(n));
}
