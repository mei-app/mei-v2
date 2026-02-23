import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const product = await req.json();
    const supabase = createServiceClient();

    // Get current max position
    const { data: existing } = await supabase
      .from("session_items")
      .select("position")
      .eq("session_id", sessionId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (existing?.[0]?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from("session_items")
      .insert({
        session_id: sessionId,
        product_id: product.id || null,
        title: product.title,
        brand_name: product.brand_name,
        price: product.price,
        currency: product.currency || "USD",
        image_url: product.image_url,
        product_url: product.product_url,
        position: nextPosition,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Duplicate — already in list
        return NextResponse.json({ error: "Item already in list" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/items/[sessionId] error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("session_items")
      .delete()
      .eq("id", itemId)
      .eq("session_id", sessionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/items/[sessionId] error:", err);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}
