import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildQueryFilters, scoreProduct } from "@/lib/scrapers/queryBuilder";
import type { QuizAnswers } from "@/types";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Convert quiz answers into a rich natural-language description of the
 * desired style. This gets embedded and compared against product embeddings.
 */
function buildStyleQuery(answers: QuizAnswers): string {
  const vibeMap: Record<string, string> = {
    "clean-girl":    "minimal clean simple neutral basics effortless linen cotton ribbed tonal",
    "streetwear":    "graphic oversized urban street baggy cargo utility hoodie sweatshirt",
    "beachy":        "beach coastal resort tropical linen crochet vacation sundress tie-dye",
    "old-money":     "tailored classic preppy blazer wool cashmere knit timeless refined",
    "maximalist":    "bold vibrant sequin embellished colorful statement party sparkle print",
    "dark-academia": "plaid velvet vintage structured dark academic layered turtleneck tweed",
  };
  const colorMap: Record<string, string> = {
    "neutrals":    "neutral black white beige cream grey ivory off-white",
    "earth-tones": "brown rust olive tan camel terracotta khaki earthy",
    "pastels":     "pink lavender mint blush pastel soft baby-blue sage",
    "bold":        "red cobalt fuchsia hot-pink bright vivid electric neon",
    "monochrome":  "monochrome tonal matching co-ord two-piece coordinated",
    "prints":      "floral striped printed pattern graphic polka-dot abstract",
  };
  const fitMap: Record<string, string> = {
    "oversized":   "oversized baggy relaxed loose wide drop-shoulder boxy",
    "fitted":      "fitted bodycon slim tight form-fitting second-skin",
    "flowy":       "flowy tiered pleated draped airy lightweight fluid",
    "structured":  "structured tailored boxy rigid corseted blazer",
    "mini":        "mini short above-knee micro mini-dress mini-skirt",
    "maxi":        "maxi long floor-length ankle-length maxi-dress maxi-skirt",
  };
  const occasionMap: Record<string, string> = {
    "everyday":  "casual everyday basics comfortable weekend relaxed",
    "work":      "work office professional tailored business smart blouse",
    "going-out": "night-out party going-out cocktail glamorous date-night bodycon",
    "special":   "formal special occasion gown event ceremony evening-dress",
    "all-of-it": "",
  };

  const parts: string[] = [];
  for (const v of answers.vibe || [])     if (vibeMap[v])     parts.push(vibeMap[v]);
  for (const c of answers.colors || [])   if (colorMap[c])    parts.push(colorMap[c]);
  for (const f of answers.fit || [])      if (fitMap[f])      parts.push(fitMap[f]);
  for (const o of answers.occasion || []) if (occasionMap[o]) parts.push(occasionMap[o]);

  return parts.join(" ").trim() || "clothing fashion outfit";
}

/** Fallback: keyword scoring when embeddings aren't set up yet. */
async function fetchWithScoring(
  supabase: ReturnType<typeof createServiceClient>,
  answers: QuizAnswers,
  excludeKeywords: string[],
  minPrice: number | undefined,
  maxPrice: number | undefined,
  excludeIds: string[],
  offset: number,
): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from("products")
    .select("*")
    .not("image_url", "is", null);

  if (minPrice !== undefined) query = query.gte("price", minPrice);
  if (maxPrice !== undefined) query = query.lte("price", maxPrice);
  if (excludeIds.length > 0)  query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error: qErr } = await query.limit(300);
  if (qErr) console.error("fetchWithScoring query error:", qErr);
  const candidates = (data ?? []) as Record<string, unknown>[];

  const clean = candidates.filter((p) => {
    const title = ((p.title as string) || "").toLowerCase();
    const tags  = ((p.tags  as string[]) || []).map((t) => t.toLowerCase());
    return !excludeKeywords.some((k) => title.includes(k) || tags.some((t) => t.includes(k)));
  });

  return clean
    .map((p) => ({ product: p, key: scoreProduct(p, answers) + Math.random() * 0.5 }))
    .sort((a, b) => b.key - a.key)
    .slice(0, 20)
    .map((s) => s.product);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const offset    = parseInt(searchParams.get("offset") || "0", 10);
    const excludeIds = searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("quiz_answers")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const answers = session.quiz_answers as QuizAnswers;
    const { excludeKeywords, minPrice, maxPrice } = buildQueryFilters(answers);

    // --- Try vector similarity (requires migration 002 + embedded products) ---
    if (process.env.OPENAI_API_KEY) {
      try {
        const styleQuery = buildStyleQuery(answers);
        const embeddingRes = await getOpenAI().embeddings.create({
          model: "text-embedding-3-small",
          input: styleQuery,
        });
        const queryEmbedding = embeddingRes.data[0].embedding;

        const { data: products, error: rpcError } = await supabase.rpc("match_products", {
          query_embedding:  queryEmbedding,
          match_count:      60,
          filter_min_price: minPrice ?? null,
          filter_max_price: maxPrice ?? null,
          exclude_ids:      excludeIds,
        });

        // Only use vector results if the RPC succeeded and returned data
        if (!rpcError && products && products.length > 0) {
          const candidates = products as Record<string, unknown>[];
          const filtered = candidates.filter((p) => {
            const title = ((p.title as string) || "").toLowerCase();
            const tags  = ((p.tags  as string[]) || []).map((t) => t.toLowerCase());
            return !excludeKeywords.some(
              (k) => title.includes(k) || tags.some((t) => t.includes(k))
            );
          });
          const top = filtered.slice(0, 30).sort(() => Math.random() - 0.5).slice(0, 20);
          return NextResponse.json({ products: top });
        }
      } catch {
        // Fall through to keyword scoring below
      }
    }

    // --- Fallback: keyword scoring (works without embeddings) ---
    const products = await fetchWithScoring(
      supabase, answers, excludeKeywords, minPrice, maxPrice, excludeIds, offset
    );
    return NextResponse.json({ products });

  } catch (err) {
    console.error("GET /api/items error:", err);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}
