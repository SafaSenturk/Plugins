// ÖRNEK: Next.js App Router'da webhook (app/api/webhook/route.ts)
// Kayıt (veritabanı) kısmı size ait: geçmişi nereden okuduğunuzu loadHistory'ye yazın.
import { NextResponse, type NextRequest } from "next/server";
import { createEvolutionClient } from "./evolution";
import { parseEvolutionWebhook, verifySecret, matchesKeyword, allowedByTestList } from "./webhook";
import { generateReply, type Turn } from "./ai-reply";

const wa = createEvolutionClient({
  url: process.env.EVOLUTION_API_URL ?? "",
  apiKey: process.env.EVOLUTION_API_KEY ?? "",
  instance: process.env.EVOLUTION_INSTANCE ?? "",
});

async function loadHistory(jid: string, latest: string): Promise<Turn[]> {
  void jid; // kendi veritabanınızdan son ~20 mesajı okuyun
  return [{ role: "customer", text: latest }];
}

export async function POST(req: NextRequest) {
  if (!verifySecret(req.headers.get("x-webhook-secret"), process.env.WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = parseEvolutionWebhook(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ ok: true, ignored: parsed.ignored });
  const m = parsed.message;
  if (m.fromMe || !allowedByTestList(m.phone, process.env.TEST_NUMBERS ?? "")) return NextResponse.json({ ok: true });

  if (matchesKeyword(m.text, "insan, yetkili, şikayet")) {
    await wa.sendText(m.jid, "Mesajınızı ekibimize ilettim, en kısa sürede dönüş yapacağız.");
    return NextResponse.json({ ok: true, handoff: true });
  }

  const reply = await generateReply(
    { businessName: "Örnek Kafe", businessInfo: "Her gün 09-22 açığız. Adres: …" },
    await loadHistory(m.jid, m.text),
    { apiKey: process.env.GEMINI_API_KEY ?? "" },
  );
  if (reply.text) await wa.sendText(m.jid, reply.text);
  return NextResponse.json({ ok: true, handoff: reply.handoff });
}
