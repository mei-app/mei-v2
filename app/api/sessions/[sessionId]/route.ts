import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = createServiceClient();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("session_items")
      .select("*")
      .eq("session_id", sessionId)
      .order("position", { ascending: true });

    if (itemsError) throw itemsError;

    return NextResponse.json({ session, items: items || [] });
  } catch (err) {
    console.error("GET /api/sessions/[sessionId] error:", err);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (body.quiz_answers !== undefined) updates.quiz_answers = body.quiz_answers;
    if (body.status !== undefined) updates.status = body.status;

    const { data, error } = await supabase
      .from("sessions")
      .update(updates)
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/sessions/[sessionId] error:", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
