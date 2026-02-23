import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Fetch a random sample of products for the landing page
    const { data: products, error } = await supabase
      .from("products")
      .select("id, image_url, title, brand_name, product_url")
      .not("image_url", "is", null)
      .limit(200);

    if (error) throw error;

    // Shuffle and return 24
    const shuffled = (products || []).sort(() => Math.random() - 0.5).slice(0, 24);

    return NextResponse.json({ products: shuffled });
  } catch {
    return NextResponse.json({ products: [] });
  }
}
