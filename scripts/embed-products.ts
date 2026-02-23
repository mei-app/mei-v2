/**
 * One-time script: generates OpenAI embeddings for every product that doesn't
 * have one yet and stores them in the `embedding` column.
 *
 * Run with:  npx tsx scripts/embed-products.ts
 *
 * Safe to re-run — only processes products where embedding IS NULL.
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Build a descriptive text string for a product. */
function productToText(p: {
  title: string;
  product_type: string | null;
  tags: string[];
}): string {
  const parts = [p.title, p.product_type, ...(p.tags || [])].filter(Boolean);
  return parts.join(" | ");
}

const BATCH_SIZE = 100; // OpenAI supports up to 2048 inputs per call

async function main() {
  console.log("Fetching products without embeddings…");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, product_type, tags")
    .is("embedding", null);

  if (error) {
    console.error("Error fetching products:", error.message);
    process.exit(1);
  }

  const total = products?.length ?? 0;
  console.log(`Found ${total} products to embed\n`);

  if (total === 0) {
    console.log("Nothing to do.");
    return;
  }

  const prods = products!;
  const batches = Math.ceil(total / BATCH_SIZE);

  for (let b = 0; b < batches; b++) {
    const batch = prods.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const texts = batch.map(productToText);

    process.stdout.write(
      `Batch ${b + 1}/${batches} (${batch.length} products)… `
    );

    // Generate embeddings for the whole batch in one API call
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });

    const embeddings = response.data.map((d) => d.embedding);

    // Write back to Supabase concurrently within the batch
    await Promise.all(
      batch.map((p, i) =>
        supabase
          .from("products")
          .update({ embedding: embeddings[i] })
          .eq("id", p.id)
      )
    );

    console.log("done");

    // Brief pause between batches to stay well under rate limits
    if (b + 1 < batches) await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nAll ${total} products embedded successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
