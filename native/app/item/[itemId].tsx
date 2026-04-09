import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { supabase } from "@/lib/supabase";
import { getMemberId, setMemberId } from "@/lib/member";
import type { ListItem, ItemComment } from "@/lib/types";

const { width } = Dimensions.get("window");

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();

  const [item, setItem] = useState<ListItem | null>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<(ItemComment & { display_name: string })[]>([]);
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Name prompt state (for users without a member identity yet)
  const [namePromptVisible, setNamePromptVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<"like" | "comment" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Comment input
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const memberIdRef = useRef<string | null>(null);

  useEffect(() => {
    memberIdRef.current = memberId;
  }, [memberId]);

  useEffect(() => {
    fetchAll();
  }, [itemId]);

  // Real-time: listen for likes and comments from other users (e.g. web visitors)
  useEffect(() => {
    if (!itemId) return;
    const channel = supabase
      .channel(`item_${itemId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "item_likes", filter: `item_id=eq.${itemId}` },
        (payload) => {
          if (payload.new?.member_id === memberIdRef.current) return;
          setLikes((n) => n + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "item_likes", filter: `item_id=eq.${itemId}` },
        (payload) => {
          if (payload.old?.member_id === memberIdRef.current) return;
          setLikes((n) => Math.max(0, n - 1));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "item_comments", filter: `item_id=eq.${itemId}` },
        async (payload) => {
          if (payload.new?.member_id === memberIdRef.current) return;
          const { data } = await supabase
            .from("item_comments")
            .select("*, list_members(display_name)")
            .eq("id", payload.new.id)
            .single();
          if (data) {
            setComments((prev) => [
              ...prev,
              {
                ...data,
                display_name:
                  (data.list_members as { display_name: string } | null)?.display_name ?? "?",
              },
            ]);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [itemId]);

  const fetchAll = async () => {
    const { data: itemData } = await supabase
      .from("list_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (!itemData) { setLoading(false); return; }
    setItem(itemData);

    const existingMemberId = await getMemberId(itemData.list_id);
    setMemberIdState(existingMemberId);

    const [{ data: likesData }, { data: commentsData }] = await Promise.all([
      supabase.from("item_likes").select("id, member_id").eq("item_id", itemId),
      supabase
        .from("item_comments")
        .select("*, list_members(display_name)")
        .eq("item_id", itemId)
        .order("created_at", { ascending: true }),
    ]);

    setLikes(likesData?.length ?? 0);
    if (existingMemberId) {
      setLiked(!!likesData?.find((l) => l.member_id === existingMemberId));
    }

    const formatted = (commentsData ?? []).map((c) => ({
      ...c,
      display_name: (c.list_members as { display_name: string } | null)?.display_name ?? "?",
    }));
    setComments(formatted);
    setLoading(false);
  };

  // Ensure identity before interaction — if no memberId, show name prompt
  const requireIdentity = (action: "like" | "comment"): boolean => {
    if (memberId) return true;
    setPendingAction(action);
    setNamePromptVisible(true);
    return false;
  };

  const saveName = async () => {
    if (!nameInput.trim() || !item) return;
    setSavingName(true);
    const { data: member, error } = await supabase
      .from("list_members")
      .insert({ list_id: item.list_id, display_name: nameInput.trim() })
      .select()
      .single();
    setSavingName(false);
    if (error || !member) { Alert.alert("Error", "couldn't save name"); return; }
    await setMemberId(item.list_id, member.id);
    setMemberIdState(member.id);
    setNamePromptVisible(false);
    // Now execute the pending action
    if (pendingAction === "like") handleLike(member.id);
    if (pendingAction === "comment") focusComment();
    setPendingAction(null);
  };

  const handleLike = async (overrideMemberId?: string) => {
    const mid = overrideMemberId ?? memberId;
    if (!mid) { requireIdentity("like"); return; }
    if (liked) {
      // Unlike
      await supabase.from("item_likes").delete().eq("item_id", itemId).eq("member_id", mid);
      setLiked(false);
      setLikes((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("item_likes").insert({ item_id: itemId, member_id: mid });
      setLiked(true);
      setLikes((n) => n + 1);
    }
  };

  const commentInputRef = useRef<TextInput>(null);
  const focusComment = () => {
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    if (!requireIdentity("comment")) return;
    setPostingComment(true);
    const { data: newComment } = await supabase
      .from("item_comments")
      .insert({ item_id: itemId, member_id: memberId, content: commentText.trim() })
      .select("*, list_members(display_name)")
      .single();
    setPostingComment(false);
    if (newComment) {
      setComments((prev) => [
        ...prev,
        {
          ...newComment,
          display_name: (newComment.list_members as { display_name: string } | null)?.display_name ?? "?",
        },
      ]);
      setCommentText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#000" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-black/40">item not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={["top"]} className="bg-white">
          <View className="flex-row items-center px-4 py-3 border-b border-black/10">
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
              <Text className="text-2xl">←</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Item image */}
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={{ width, height: width * 1.1 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{ width, height: width * 1.1 }}
              className="bg-black/5 items-center justify-center"
            >
              <Text className="text-black/20 text-6xl">🛍</Text>
            </View>
          )}

          {/* Item info */}
          <View className="px-6 pt-5 pb-4">
            {item.brand ? (
              <Text className="text-xs text-black/40 uppercase tracking-wider mb-1">
                {item.brand}
              </Text>
            ) : null}
            {item.title ? (
              <Text className="text-xl font-bold leading-snug mb-1">{item.title}</Text>
            ) : null}
            {item.price ? (
              <Text className="text-base text-black/60 mb-4">${item.price}</Text>
            ) : null}

            {/* Like row + Go to item */}
            <View className="flex-row items-center gap-4 mb-5">
              <TouchableOpacity
                className="flex-row items-center gap-1.5"
                onPress={() => handleLike()}
              >
                <Text className="text-2xl">{liked ? "❤️" : "🤍"}</Text>
                <Text className="text-base font-semibold">{likes}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 border-2 border-black py-3 items-center"
                onPress={() =>
                  router.push({ pathname: "/browser", params: { url: item.url } })
                }
              >
                <Text className="font-bold text-sm">go to item →</Text>
              </TouchableOpacity>
            </View>

            {/* Comments */}
            <Text className="text-base font-bold mb-3">
              {comments.length === 0 ? "no feedback yet" : `feedback (${comments.length})`}
            </Text>

            {comments.map((c) => (
              <View key={c.id} className="mb-4">
                <Text className="text-xs font-bold text-black/50 mb-0.5 uppercase tracking-wider">
                  {c.display_name}
                </Text>
                <Text className="text-base leading-snug">{c.content}</Text>
              </View>
            ))}

            <View style={{ height: 20 }} />
          </View>
        </ScrollView>

        {/* Comment input */}
        <SafeAreaView edges={["bottom"]} className="bg-white border-t border-black/10">
          <View className="flex-row items-center px-4 py-2 gap-3">
            <TextInput
              ref={commentInputRef}
              className="flex-1 text-base py-2"
              placeholder="leave feedback..."
              placeholderTextColor="#00000030"
              value={commentText}
              onChangeText={setCommentText}
              returnKeyType="send"
              onSubmitEditing={postComment}
              multiline={false}
              onFocus={() => {
                if (!memberId) {
                  commentInputRef.current?.blur();
                  requireIdentity("comment");
                }
              }}
            />
            <TouchableOpacity
              onPress={postComment}
              disabled={postingComment || !commentText.trim()}
              style={{ opacity: postingComment || !commentText.trim() ? 0.3 : 1 }}
            >
              {postingComment ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text className="font-bold text-base">send</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Name prompt overlay */}
      {namePromptVisible ? (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View className="bg-white px-6 pt-6 pb-10">
              <Text className="text-2xl font-bold mb-2">what's your name?</Text>
              <Text className="text-black/50 text-sm mb-5">
                so your feedback shows up properly
              </Text>
              <TextInput
                className="border-b-2 border-black text-xl pb-2 mb-6"
                placeholder="your name..."
                placeholderTextColor="#00000030"
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                autoCapitalize="words"
                returnKeyType="go"
                onSubmitEditing={saveName}
              />
              <TouchableOpacity
                className="bg-black py-4 items-center"
                onPress={saveName}
                disabled={savingName || !nameInput.trim()}
                style={{ opacity: savingName || !nameInput.trim() ? 0.4 : 1 }}
              >
                {savingName ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}
