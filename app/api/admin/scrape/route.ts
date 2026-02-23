import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { BRANDS } from "@/lib/scrapers/brands";
import { scrapeBrand } from "@/lib/scrapers/shopify";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SCRAPE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results: Record<string, number | string> = {};

  for (const brand of BRANDS) {
    try {
      const products = await scrapeBrand(brand);
      if (products.length > 0) {
        const { error } = await supabase
          .from("products")
          .upsert(products, { onConflict: "brand_id,external_id" });
        results[brand.id] = error ? `error: ${error.message}` : products.length;
      } else {
        results[brand.id] = 0;
      }
    } catch (err) {
      results[brand.id] = `failed: ${String(err)}`;
    }
  }

  return NextResponse.json({ results });
}
