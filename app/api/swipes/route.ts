import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { session_id, item_id, decision } = await req.json();

    if (!session_id || !item_id || !decision) {
      return NextResponse.json({ error: "session_id, item_id, and decision are required" }, { status: 400 });
    }

    if (!["yes", "no"].includes(decision)) {
      return NextResponse.json({ error: "decision must be 'yes' or 'no'" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("swipe_results")
      .upsert({ session_id, item_id, decision }, { onConflict: "session_id,item_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/swipes error:", err);
    return NextResponse.json({ error: "Failed to record swipe" }, { status: 500 });
  }
}
