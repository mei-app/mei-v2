/**
 * Scrapes all 13 brand catalogs from Shopify and upserts into Supabase products table.
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/scrape-brands.ts
 *
 * Requires .env.local to have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

// Dynamic import to avoid TS module issues
async function main() {
  const { BRANDS } = await import("../lib/scrapers/brands");
  const { scrapeBrand } = await import("../lib/scrapers/shopify");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let totalInserted = 0;
  let totalFailed = 0;

  for (const brand of BRANDS) {
    console.log(`\nScraping ${brand.name} (${brand.domain})...`);

    try {
      const products = await scrapeBrand(brand);
      console.log(`  Found ${products.length} products`);

      if (products.length === 0) {
        console.log(`  ⚠️  No products found for ${brand.name}`);
        totalFailed++;
        continue;
      }

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const { error } = await supabase
          .from("products")
          .upsert(batch, { onConflict: "brand_id,external_id" });

        if (error) {
          console.error(`  ❌ Error upserting batch for ${brand.name}:`, error.message);
        }
      }

      console.log(`  ✅ ${brand.name} — ${products.length} products synced`);
      totalInserted += products.length;
    } catch (err) {
      console.error(`  ❌ Failed to scrape ${brand.name}:`, err);
      totalFailed++;
    }

    // Small delay between brands to be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n✅ Done! ${totalInserted} total products synced. ${totalFailed} brands failed.`);
}

main().catch(console.error);
