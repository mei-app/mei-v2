import type { QuizAnswers } from "@/types";

// ---------------------------------------------------------------------------
// Keyword dictionaries — deliberately broad to cover tag/title conventions
// across all 13 brands. Matching happens against title + product_type + tags.
// ---------------------------------------------------------------------------

const VIBE_KEYWORDS: Record<string, string[]> = {
  "clean-girl": [
    "minimal", "minimalist", "clean", "simple", "basic", "basics",
    "neutral", "beige", "cream", "ivory", "sand", "nude",
    "linen", "cotton", "ribbed", "tonal", "elevated", "effortless",
    "classic", "understated", "refined", "sleek", "muted",
  ],
  "streetwear": [
    "graphic", "oversized", "baggy", "cargo", "hoodie", "hooded",
    "sweatshirt", "jogger", "urban", "skate", "street", "bold text",
    "chunky", "utility", "relaxed", "fleece", "zip-up", "jersey",
    "drop shoulder", "wide leg", "parachute", "puffer", "workwear",
  ],
  "beachy": [
    "beach", "coastal", "resort", "vacation", "tropical", "island",
    "linen", "crochet", "woven", "gauze", "stripe", "striped",
    "nautical", "tie dye", "tie-dye", "cover up", "coverup",
    "off shoulder", "ruffled", "flowy", "sundress", "swimwear",
    "bikini", "sarong", "raffia", "palm",
  ],
  "old-money": [
    "tailored", "classic", "timeless", "preppy", "refined", "elevated",
    "blazer", "cashmere", "wool", "knit", "cable knit", "tweed",
    "plaid", "checked", "herringbone", "houndstooth", "oxford",
    "polo", "button down", "button-down", "structured", "crisp",
    "loafer", "trench", "lapel", "collegiate",
  ],
  "maximalist": [
    "sequin", "sequined", "feather", "embellished", "glitter", "metallic",
    "statement", "bold", "vibrant", "colorful", "printed", "pattern",
    "floral", "tropical", "color block", "colorblock", "patchwork",
    "rhinestone", "sparkle", "shimmer", "dramatic", "party",
    "fringe", "ruffles", "tulle",
  ],
  "dark-academia": [
    "plaid", "tartan", "houndstooth", "tweed", "corduroy", "velvet",
    "vintage", "retro", "academic", "dark", "moody", "rich",
    "brown", "burgundy", "forest green", "emerald", "mustard",
    "structured", "layered", "turtleneck", "longline", "library",
  ],
};

const COLOR_KEYWORDS: Record<string, string[]> = {
  "neutrals": [
    "black", "white", "grey", "gray", "beige", "cream", "ivory",
    "sand", "off white", "off-white", "ecru", "stone", "nude",
    "natural", "neutral", "taupe", "chalk", "oatmeal",
  ],
  "earth-tones": [
    "brown", "rust", "olive", "tan", "camel", "terracotta", "khaki",
    "clay", "cognac", "copper", "burnt orange", "earthy", "tobacco",
    "chocolate", "mocha", "hazel", "sienna", "ochre",
  ],
  "pastels": [
    "pink", "lavender", "mint", "lilac", "blush", "baby blue", "sky blue",
    "powder blue", "mauve", "rose", "peach", "soft", "pastel", "light",
    "pale", "butter yellow", "sage", "periwinkle", "soft pink",
  ],
  "bold": [
    "red", "cobalt", "yellow", "orange", "electric", "neon", "bright",
    "hot pink", "fuchsia", "lime", "magenta", "violet", "royal blue",
    "emerald", "vivid", "pop", "color", "cerulean", "scarlet",
  ],
  "monochrome": [
    "monochrome", "tonal", "all black", "all-black", "all white", "all-white",
    "matching set", "co-ord", "coord", "two piece", "matching",
  ],
  "prints": [
    "floral", "stripe", "striped", "check", "leopard", "zebra", "snake",
    "abstract", "pattern", "print", "printed", "polka dot", "ditsy",
    "tie dye", "graphic print", "tropical", "plaid", "geometric",
    "animal print", "paisley", "ikat",
  ],
};

const FIT_KEYWORDS: Record<string, string[]> = {
  "oversized": ["oversized", "baggy", "relaxed fit", "loose", "drop shoulder", "boxy", "wide fit"],
  "fitted":    ["fitted", "bodycon", "slim", "tight", "second skin", "figure hugging", "form fitting"],
  "flowy":     ["flowy", "floaty", "tiered", "pleated", "airy", "lightweight", "draped", "fluid"],
  "structured":["structured", "boxy", "tailored", "rigid", "corseted", "boned", "stiff"],
  "mini":      ["mini", "micro", "short hemline", "thigh", "above knee", "ultra short"],
  "maxi":      ["maxi", "floor length", "ankle length", "longline", "full length"],
};

// Shopify product_type values are more standardised — map fits to them
const FIT_PRODUCT_TYPES: Record<string, string[]> = {
  "mini":       ["mini dress", "mini skirt", "shorts", "hot pants", "micro skirt"],
  "maxi":       ["maxi dress", "maxi skirt", "long dress", "floor length dress"],
  "flowy":      ["midi dress", "maxi dress", "skirt", "blouse", "sundress", "wrap dress"],
  "structured": ["blazer", "suit", "coat", "jacket", "corset", "vest", "waistcoat"],
  "oversized":  ["hoodie", "sweater", "sweatshirt", "jacket", "coat", "cardigan", "knitwear"],
  "fitted":     ["bodysuit", "bodycon dress", "leotard", "corset top", "bandeau"],
};

const OCCASION_KEYWORDS: Record<string, string[]> = {
  "everyday":  ["casual", "everyday", "daily", "basics", "weekend", "relaxed", "easy",
                "effortless", "comfortable", "day to day", "versatile"],
  "work":      ["work", "office", "professional", "business", "smart", "tailored",
                "corporate", "workwear", "desk", "career"],
  "going-out": ["going out", "night out", "party", "club", "evening", "date night",
                "cocktail", "bodycon", "glam", "drinks"],
  "special":   ["formal", "gown", "bridal", "wedding", "occasion", "special event",
                "ceremony", "prom", "ball", "black tie"],
  "all-of-it": [],
};

const OCCASION_PRODUCT_TYPES: Record<string, string[]> = {
  "everyday":  ["top", "t-shirt", "tee", "jeans", "shorts", "sweater", "sweatshirt",
                "casual dress", "tank"],
  "work":      ["blazer", "trousers", "pants", "blouse", "midi dress", "pencil skirt",
                "button down", "shirt"],
  "going-out": ["mini dress", "bodysuit", "corset top", "going out top", "mini skirt",
                "party dress"],
  "special":   ["gown", "formal dress", "evening dress", "cocktail dress", "occasion dress",
                "ball gown"],
  "all-of-it": [],
};

const AVOID_KEYWORDS: Record<string, string[]> = {
  "animal-print": ["leopard", "snake", "zebra", "animal print", "cheetah", "croc",
                   "python", "tiger", "animal"],
  "loud-logos":   ["logo", "monogram", "branded", "brand logo", "designer logo"],
  "sheer":        ["sheer", "mesh", "see-through", "transparent", "semi-sheer", "fishnet"],
  "athleisure":   ["gym", "sports bra", "leggings", "athletic", "workout", "activewear",
                   "yoga", "running", "sports"],
};

const BUDGET_RANGES: Record<string, { min?: number; max?: number }> = {
  "under-50": { max: 50 },
  "50-100":   { min: 50, max: 100 },
  "100-200":  { min: 100, max: 200 },
  "200-plus": { min: 200 },
};

// ---------------------------------------------------------------------------
// Filters (SQL-level — hard constraints only)
// ---------------------------------------------------------------------------

export interface QueryFilters {
  excludeKeywords: string[];
  minPrice?: number;
  maxPrice?: number;
}

export function buildQueryFilters(answers: QuizAnswers): QueryFilters {
  const excludeKeywords: string[] = [];

  for (const a of answers.avoid || []) {
    if (a === "nothing") continue;
    excludeKeywords.push(...(AVOID_KEYWORDS[a] || []));
  }

  // Use the full range across ALL selected budget options
  const budgets = answers.budget || [];
  let minPrice: number | undefined;
  let maxPrice: number | undefined;

  for (const b of budgets) {
    const range = BUDGET_RANGES[b];
    if (!range) continue;
    if (range.min !== undefined) {
      minPrice = minPrice === undefined ? range.min : Math.min(minPrice, range.min);
    }
    if (range.max !== undefined) {
      maxPrice = maxPrice === undefined ? range.max : Math.max(maxPrice, range.max);
    }
    // "200+" has no upper bound — drop maxPrice constraint entirely
    if (!range.max) maxPrice = undefined;
  }

  return {
    excludeKeywords: [...new Set(excludeKeywords)],
    minPrice,
    maxPrice,
  };
}

// ---------------------------------------------------------------------------
// Scoring (JS-level — item-by-item against quiz answers)
// ---------------------------------------------------------------------------

export function scoreProduct(
  product: Record<string, unknown>,
  answers: QuizAnswers
): number {
  const title = ((product.title as string) || "").toLowerCase();
  const tags = ((product.tags as string[]) || []).map((t) => t.toLowerCase());
  const productType = ((product.product_type as string) || "").toLowerCase();

  // Single string for easy substring search
  const allText = [title, productType, ...tags].join(" ");

  const countMatches = (keywords: string[]) =>
    keywords.reduce(
      (sum, kw) => (allText.includes(kw.toLowerCase()) ? sum + 1 : sum),
      0
    );

  let score = 0;

  // Vibe — weight 3 per matching keyword
  for (const vibe of answers.vibe || []) {
    score += countMatches(VIBE_KEYWORDS[vibe] || []) * 3;
  }

  // Colors — weight 2
  for (const color of answers.colors || []) {
    score += countMatches(COLOR_KEYWORDS[color] || []) * 2;
  }

  // Fit — weight 4 per keyword + 6-point bonus for product_type hit (most item-specific)
  for (const fit of answers.fit || []) {
    score += countMatches(FIT_KEYWORDS[fit] || []) * 4;
    const fitTypes = FIT_PRODUCT_TYPES[fit] || [];
    if (fitTypes.some((t) => productType.includes(t.toLowerCase()))) {
      score += 6;
    }
  }

  // Occasion — weight 3 + 4-point bonus for product_type hit
  for (const occ of answers.occasion || []) {
    if (occ === "all-of-it") continue;
    score += countMatches(OCCASION_KEYWORDS[occ] || []) * 3;
    const occTypes = OCCASION_PRODUCT_TYPES[occ] || [];
    if (occTypes.some((t) => productType.includes(t.toLowerCase()))) {
      score += 4;
    }
  }

  return score;
}
