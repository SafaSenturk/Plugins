/**
 * İşletme adına WhatsApp cevabı üreten yapay zekâ katmanı (Google Gemini).
 * - Yalnızca verdiğiniz işletme bilgisine dayanır, uydurmaz.
 * - Cevaplayamayacağı durumda (şikâyet, ödeme, "insanla görüşmek istiyorum")
 *   handoff: true döner; konuşmayı bir çalışana devredin.
 * - Model yoğunsa (429/503) yedek modele geçer.
 * Gerekli paket: @google/genai
 */
import { GoogleGenAI } from "@google/genai";

export type Turn = { role: "customer" | "business"; text: string };

export type AssistantProfile = {
  businessName: string;
  businessInfo: string;   // fiyatlar, saatler, adres, kurallar… tek doğru kaynak
  tone?: string;          // "samimi ama kibar", "resmî" …
  extraRules?: string[];
};

export type ReplyOptions = {
  apiKey: string;
  model?: string;
  fallbackModel?: string;
  temperature?: number;
};

const HANDOFF_TAG = "[DEVRET]";

export function buildSystemPrompt(p: AssistantProfile): string {
  return [
    `Sen ${p.businessName || "bir işletme"} adına WhatsApp'tan müşterilere cevap veren asistansın.`,
    "",
    "İşletme bilgileri (tek doğru bilgi kaynağın):",
    p.businessInfo || "(Henüz işletme bilgisi girilmedi.)",
    "",
    `Üslup: ${p.tone || "samimi, kısa ve kibar"}`,
    "",
    "Kurallar:",
    "- WhatsApp mesajı yazıyorsun: kısa yaz, en fazla birkaç cümle. Markdown, başlık veya madde işareti kullanma.",
    "- Yalnızca yukarıdaki işletme bilgilerine dayan. Bilgilerde olmayan fiyat, stok, tarih veya söz uydurma.",
    "- Müşterinin dilinde cevap ver.",
    `- Cevabını bilmediğin bir şey sorulursa, müşteri bir insanla görüşmek isterse, şikâyet ederse ya da sipariş/ödeme gibi senin tamamlayamayacağın bir işlem isterse cevabının en başına ${HANDOFF_TAG} yaz ve konuyu ekibe ilettiğini kısaca söyle.`,
    "- Bir yapay zekâ asistanı olduğun sorulursa dürüstçe söyle.",
    ...(p.extraRules ?? []).map((r) => "- " + r),
  ].join("\n");
}

export async function generateReply(
  profile: AssistantProfile,
  history: Turn[],
  opts: ReplyOptions,
): Promise<{ text: string; handoff: boolean }> {
  if (!opts.apiKey) throw new Error("Gemini API anahtarı eksik");
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const primary = opts.model || "gemini-flash-latest";
  const fallback = opts.fallbackModel || "gemini-flash-lite-latest";
  // Başarısız istek ~8 sn sürdüğü için asıl model yeniden denenmez; müşteri bekletilmez.
  const attempts = primary === fallback ? [primary, primary] : [primary, fallback];

  let raw = "";
  for (let i = 0; i < attempts.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: attempts[i],
        contents: history.map((t) => ({ role: t.role === "customer" ? "user" : "model", parts: [{ text: t.text }] })),
        config: { systemInstruction: buildSystemPrompt(profile), temperature: opts.temperature ?? 0.5, maxOutputTokens: 1024 },
      });
      raw = (response.text ?? "").trim();
      break;
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 503 || status === 429 || status === 500;
      if (!retryable || i === attempts.length - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return { text: raw.split(HANDOFF_TAG).join("").trim(), handoff: raw.includes(HANDOFF_TAG) };
}
