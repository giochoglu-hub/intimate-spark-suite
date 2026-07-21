import { createFileRoute } from "@tanstack/react-router";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const VALID_MODULES = [
  "warmup",
  "flirt",
  "intimacy",
  "memories",
  "truth",
  "dare",
  "whoAmI",
  "taboo",
  "charades",
  "rapidFire",
  "story",
  "okNok",
  "guessMe",
  "sexDice",
] as const;

const VALID_LEVELS = ["warmup", "flirt", "intimacy", "memories", ""] as const;

const bodySchema = z.object({
  module: z.enum(VALID_MODULES),
  level: z.string().max(20).optional().default(""),
  count: z.number().int().min(1).max(10),
  hardness: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  avoidTitles: z.array(z.string().max(120)).max(100).optional().default([]),
});

const cardSchema = z.object({
  cards: z
    .array(
      z.object({
        title: z.string(),
        prompt: z.string(),
        tags: z.array(z.string()).optional().default([]),
        category: z.string().optional().default("genel"),
        hardness: z.number().min(1).max(5).optional().default(3),
      }),
    )
    .max(10),
});

// Simple in-memory IP rate limiting (best-effort — resets on cold start).
const rateStore = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = rateStore.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    rateStore.set(ip, { count: 1, ts: now });
    return true;
  }
  if (rec.count >= MAX_PER_WINDOW) return false;
  rec.count += 1;
  return true;
}

function newRequestId() {
  return "req_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function jsonError(
  code: string,
  message: string,
  status: number,
  requestId: string,
) {
  return new Response(
    JSON.stringify({ ok: false, code, message, requestId }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function sanitize(text: string, max: number): string {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

const MODULE_LABEL: Record<string, string> = {
  warmup: "Isınma seviyesi — hafif, samimi, tanışma soruları",
  flirt: "Flört seviyesi — oyuncu, göz kırpan, hafif çekici sorular",
  intimacy: "Yakınlaşma seviyesi — duygusal derinlik, dokunma, arzu; rıza ve pas dili şart",
  memories: "Anılarımız — çiftin geçmişi, ortak anılar, ilk seferler",
  truth: "Doğruluk mu Cesaret mi — Doğruluk soruları",
  dare: "Doğruluk mu Cesaret mi — Cesaret görevleri (güvenli, ev içinde yapılabilir)",
  whoAmI: "Ben Kimim — partnerle veya kendisiyle ilgili kısa tahmin kartı",
  taboo: "Tabu-lite — bir kelime ve söylenmesi yasak 3 kelime (Türkçe)",
  charades: "Sessiz Sinema — canlandırılacak durum/karakter/anı",
  rapidFire: "Hızlı Ateş — 5 kısa, hızlı cevaplanacak soru",
  story: "Hikâye Tamamla — bir hikâye başlangıcı",
  okNok: "OK mu NOK mu — ilişki alışkanlıkları hakkında ikili cevaplanacak durumlar",
  guessMe: "Beni Tahmin Et — partnerin cevabını tahmin edeceği kişisel soru",
  sexDice: "Sex Zarı — rızaya dayalı, yetişkin, kısa eylem/pozisyon önerisi",
};

function buildPrompt(data: z.infer<typeof bodySchema>) {
  const label = MODULE_LABEL[data.module] ?? data.module;
  const avoid = data.avoidTitles.slice(0, 50).map((t) => `- ${t}`).join("\n");
  return `Ozzy ve Su adında iki yetişkin, birbirini seven bir çift için Türkçe oyun kartları üret.

Modül: ${label}
Sertlik seviyesi (1=çok hafif, 5=çok cesur): ${data.hardness}
İstenen kart sayısı: ${data.count}

Kurallar:
- Türkçe yaz, ikinci tekil şahıs kullan ("sen").
- Yargısız, doğal, samimi, yaratıcı ve zaman zaman eğlenceli ol.
- Genel internet listelerindeki klişe soruları TEKRAR ETME.
- Aşağıdaki başlıklarla aynı veya çok benzer içerik ÜRETME:
${avoid || "(yok)"}
- İstenen sertlik seviyesini AŞMA.
- Rıza ve pas hakkını destekle. Baskı, manipülasyon, aşağılama veya suçluluk dili KULLANMA.
- Yasa dışı, tehlikeli, zarar verici veya rıza dışı içerik ÜRETME.
- Partnerleri karşılaştıran veya eski partnerleri küçümseyen içerik üretme.
- Uyumluluk puanı, sağlık ya da psikolojik teşhis üretme.
- Her kart birbirinden belirgin biçimde farklı olsun.

Her kart için:
- title: kısa, çekici başlık (maks 60 karakter)
- prompt: asıl soru veya görev (maks 240 karakter)
- tags: 1-4 kısa etiket
- category: kısa kategori adı
- hardness: 1-5 arası tam sayı, ${data.hardness}'i aşmasın

Sadece JSON döndür: { "cards": [ { title, prompt, tags, category, hardness } ] }`;
}

async function handlePost(request: Request) {
  const requestId = newRequestId();

  // Body size guard.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 20_000) {
    return jsonError("INVALID_REQUEST", "İstek gövdesi çok büyük.", 413, requestId);
  }

  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (!rateLimit(ip)) {
    return jsonError(
      "RATE_LIMITED",
      "Yeni kart üretme limiti doldu. Biraz sonra tekrar dene.",
      429,
      requestId,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("INVALID_REQUEST", "Geçersiz JSON.", 400, requestId);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("INVALID_REQUEST", "İstek gövdesi doğrulanamadı.", 400, requestId);
  }
  const data = parsed.data;

  if (data.level && !VALID_LEVELS.includes(data.level as typeof VALID_LEVELS[number])) {
    return jsonError("INVALID_REQUEST", "Geçersiz seviye.", 400, requestId);
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    return jsonError("AI_UNAVAILABLE", "AI servisi şu an kullanılamıyor.", 503, requestId);
  }

  const modelName = process.env.BIZIM_OYUN_AI_MODEL || "google/gemini-3.5-flash";
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway(modelName);

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: cardSchema }),
      prompt: buildPrompt(data),
      temperature: 0.9,
    });

    const cards = (output.cards || []).slice(0, data.count).map((c) => ({
      title: sanitize(c.title, 80),
      prompt: sanitize(c.prompt, 280),
      tags: (c.tags || []).slice(0, 6).map((t) => sanitize(t, 24)).filter(Boolean),
      category: sanitize(c.category || "genel", 32),
      hardness: Math.max(1, Math.min(5, Math.round(c.hardness ?? data.hardness))) as 1 | 2 | 3 | 4 | 5,
    })).filter((c) => c.title && c.prompt);

    if (cards.length === 0) {
      return jsonError("INVALID_AI_RESPONSE", "AI geçerli kart üretemedi.", 502, requestId);
    }

    return new Response(JSON.stringify({ ok: true, cards, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    const status = err?.statusCode;
    if (status === 429) {
      return jsonError("RATE_LIMITED", "AI şu an çok yoğun. Biraz sonra dene.", 429, requestId);
    }
    if (status === 402) {
      return jsonError("PAYMENT_REQUIRED", "AI kredisi tükendi.", 402, requestId);
    }
    if (NoObjectGeneratedError.isInstance(error)) {
      return jsonError("INVALID_AI_RESPONSE", "AI cevabı işlenemedi.", 502, requestId);
    }
    console.error("bizim-oyun-generate error", err?.message ?? error);
    return jsonError("INTERNAL_ERROR", "Beklenmedik bir hata oluştu.", 500, requestId);
  }
}

export const Route = createFileRoute("/api/public/bizim-oyun-generate")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePost(request),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
