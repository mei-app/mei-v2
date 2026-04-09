import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import type { List, ListItem } from "@/lib/types";

const ITEM_GAP = 12;
const SIDE_PADDING = 24;

type ItemWithCounts = ListItem & { likeCount: number; commentCount: number };

export default function ListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<ItemWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    fetchListAndItems();
  }, [listId]);

  const fetchListAndItems = async () => {
    const [{ data: listData }, { data: itemsData }] = await Promise.all([
      supabase.from("lists").select("*").eq("id", listId).single(),
      supabase
        .from("list_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: false }),
    ]);
    if (listData) setList(listData);

    if (itemsData && itemsData.length > 0) {
      const ids = itemsData.map((i) => i.id);
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase.from("item_likes").select("item_id").in("item_id", ids),
        supabase.from("item_comments").select("item_id").in("item_id", ids),
      ]);

      const likeCounts: Record<string, number> = {};
      const commentCounts: Record<string, number> = {};
      (likesData ?? []).forEach((l) => { likeCounts[l.item_id] = (likeCounts[l.item_id] ?? 0) + 1; });
      (commentsData ?? []).forEach((c) => { commentCounts[c.item_id] = (commentCounts[c.item_id] ?? 0) + 1; });

      setItems(itemsData.map((item) => ({
        ...item,
        likeCount: likeCounts[item.id] ?? 0,
        commentCount: commentCounts[item.id] ?? 0,
      })));
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const handleShare = async () => {
    setSharing(true);
    let { data: share } = await supabase
      .from("list_shares")
      .select("token")
      .eq("list_id", listId)
      .single();

    if (!share) {
      const { data: newShare } = await supabase
        .from("list_shares")
        .insert({ list_id: listId })
        .select("token")
        .single();
      share = newShare;
    }

    setSharing(false);
    if (!share) { Alert.alert("Error", "couldn't generate invite link"); return; }

    const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    const token = String(share.token).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? String(share.token);
    const link = `${apiUrl}/list/${token}`;
    await Clipboard.setStringAsync(link);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const deleteItem = (id: string) => {
    Alert.alert("remove item?", "this can't be undone", [
      { text: "cancel", style: "cancel" },
      {
        text: "remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("list_items").delete().eq("id", id);
          setItems((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  const { width } = Dimensions.get("window");
  const itemWidth = (width - SIDE_PADDING * 2 - ITEM_GAP) / 2;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center gap-3 border-b border-black/10">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-black flex-1" numberOfLines={1}>
          {list?.name}
        </Text>
        <TouchableOpacity onPress={handleShare} disabled={sharing} hitSlop={8}>
          {sharing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text className="text-sm font-bold">
              {shareCopied ? "✓ copied!" : "share"}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-black px-4 py-2"
          onPress={() => router.push({ pathname: "/browser", params: { listId } })}
        >
          <Text className="text-white font-bold text-sm">+ add</Text>
        </TouchableOpacity>
      </View>

      {/* Items grid */}
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-2xl font-bold mb-2 text-center">no items yet</Text>
          <Text className="text-black/50 text-center text-sm mb-8">
            browse any shopping site and tap "+ add to list" to save items here
          </Text>
          <TouchableOpacity
            className="bg-black px-6 py-3"
            onPress={() => router.push({ pathname: "/browser", params: { listId } })}
          >
            <Text className="text-white font-bold">start browsing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SIDE_PADDING }}
          columnWrapperStyle={{ gap: ITEM_GAP, marginBottom: ITEM_GAP }}
          renderItem={({ item }) => (
            <Pressable
              style={{ width: itemWidth }}
              onPress={() =>
                router.push({ pathname: "/item/[itemId]", params: { itemId: item.id } })
              }
            >
              {/* Delete button top-right */}
              <TouchableOpacity
                onPress={() => deleteItem(item.id)}
                hitSlop={4}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  zIndex: 10,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, lineHeight: 14 }}>✕</Text>
              </TouchableOpacity>

              {/* Like + comment counts top-left */}
              {(item.likeCount > 0 || item.commentCount > 0) ? (
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    zIndex: 10,
                    flexDirection: "row",
                    gap: 4,
                  }}
                >
                  {item.likeCount > 0 ? (
                    <View
                      style={{
                        backgroundColor: "rgba(0,0,0,0.55)",
                        borderRadius: 12,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10 }}>❤️</Text>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                        {item.likeCount}
                      </Text>
                    </View>
                  ) : null}
                  {item.commentCount > 0 ? (
                    <View
                      style={{
                        backgroundColor: "rgba(0,0,0,0.55)",
                        borderRadius: 12,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Text style={{ fontSize: 10 }}>💬</Text>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                        {item.commentCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: itemWidth, height: itemWidth * 1.25 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{ width: itemWidth, height: itemWidth * 1.25 }}
                  className="bg-black/5 items-center justify-center"
                >
                  <Text className="text-black/20 text-4xl">🛍</Text>
                </View>
              )}
              <View className="mt-2 gap-0.5">
                {item.brand ? (
                  <Text className="text-xs text-black/40 uppercase tracking-wider" numberOfLines={1}>
                    {item.brand}
                  </Text>
                ) : null}
                {item.title ? (
                  <Text className="text-sm font-semibold leading-tight" numberOfLines={2}>
                    {item.title}
                  </Text>
                ) : null}
                {item.price ? (
                  <Text className="text-sm text-black/50">${item.price}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
