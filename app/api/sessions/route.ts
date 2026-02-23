import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { stylist_name, friend_name } = await req.json();

    if (!friend_name?.trim()) {
      return NextResponse.json({ error: "friend_name is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        stylist_name: (stylist_name || "").trim(),
        friend_name: friend_name.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
