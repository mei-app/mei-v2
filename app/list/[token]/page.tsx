import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import ListPageClient from "./ListPageClient";

export type ItemWithCounts = {
  id: string;
  list_id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  price: string | null;
  brand: string | null;
  created_at: string;
  likeCount: number;
  commentCount: number;
};

export default async function ListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: share } = await supabase
    .from("list_shares")
    .select("list_id")
    .eq("token", token)
    .single();

  if (!share) notFound();

  const [{ data: list }, { data: rawItems }] = await Promise.all([
    supabase.from("lists").select("id, name").eq("id", share.list_id).single(),
    supabase
      .from("list_items")
      .select("*")
      .eq("list_id", share.list_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!list) notFound();

  const items = rawItems ?? [];
  const itemIds = items.map((i) => i.id);

  let likeCounts: Record<string, number> = {};
  let commentCounts: Record<string, number> = {};

  if (itemIds.length > 0) {
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase.from("item_likes").select("item_id").in("item_id", itemIds),
      supabase.from("item_comments").select("item_id").in("item_id", itemIds),
    ]);
    (likes ?? []).forEach((l) => {
      likeCounts[l.item_id] = (likeCounts[l.item_id] ?? 0) + 1;
    });
    (comments ?? []).forEach((c) => {
      commentCounts[c.item_id] = (commentCounts[c.item_id] ?? 0) + 1;
    });
  }

  const itemsWithCounts: ItemWithCounts[] = items.map((item) => ({
    ...item,
    likeCount: likeCounts[item.id] ?? 0,
    commentCount: commentCounts[item.id] ?? 0,
  }));

  return (
    <ListPageClient
      list={{ id: list.id, name: list.name }}
      items={itemsWithCounts}
    />
  );
}
