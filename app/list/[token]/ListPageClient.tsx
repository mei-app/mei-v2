"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { ItemWithCounts } from "./page";

type Comment = {
  id: string;
  item_id: string;
  member_id: string;
  content: string;
  created_at: string;
  display_name: string;
};

export default function ListPageClient({
  list,
  items: initialItems,
}: {
  list: { id: string; name: string };
  items: ItemWithCounts[];
}) {
  const supabase = createClient();
  const memberKey = `mei_member_${list.id}`;

  const [items, setItems] = useState(initialItems);
  const [selectedItem, setSelectedItem] = useState<ItemWithCounts | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  // Name prompt
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"like" | "comment" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Item detail
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Refs to avoid stale closures in real-time handlers
  const selectedItemIdRef = useRef<string | null>(null);
  const memberIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedItemIdRef.current = selectedItem?.id ?? null;
  }, [selectedItem]);

  useEffect(() => {
    memberIdRef.current = memberId;
  }, [memberId]);

  // Load identity from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem(memberKey);
    if (storedId) setMemberId(storedId);
  }, [memberKey]);

  // Supabase real-time — updates grid counts + open item detail
  useEffect(() => {
    const channel = supabase
      .channel(`list_${list.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "item_likes" },
        (payload) => {
          const itemId = payload.new?.item_id;
          if (!itemId) return;
          // Skip our own optimistic updates
          if (payload.new?.member_id === memberIdRef.current) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...item, likeCount: item.likeCount + 1 } : item
            )
          );
          if (selectedItemIdRef.current === itemId) {
            setLikes((n) => n + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "item_likes" },
        (payload) => {
          const itemId = payload.old?.item_id;
          if (!itemId) return;
          if (payload.old?.member_id === memberIdRef.current) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, likeCount: Math.max(0, item.likeCount - 1) }
                : item
            )
          );
          if (selectedItemIdRef.current === itemId) {
            setLikes((n) => Math.max(0, n - 1));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "item_comments" },
        (payload) => {
          const itemId = payload.new?.item_id;
          if (!itemId) return;
          if (payload.new?.member_id === memberIdRef.current) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, commentCount: item.commentCount + 1 }
                : item
            )
          );
          if (selectedItemIdRef.current === itemId) {
            // Fetch the full comment with display_name
            (async () => {
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
                      (data.list_members as { display_name: string } | null)
                        ?.display_name ?? "?",
                  },
                ]);
              }
            })();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [list.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open item and fetch full detail
  const openItem = async (item: ItemWithCounts) => {
    setSelectedItem(item);
    setLoadingDetail(true);
    setComments([]);
    setLikes(0);
    setLiked(false);

    const storedMemberId = localStorage.getItem(memberKey);

    const [{ data: likesData }, { data: commentsData }] = await Promise.all([
      supabase.from("item_likes").select("id, member_id").eq("item_id", item.id),
      supabase
        .from("item_comments")
        .select("*, list_members(display_name)")
        .eq("item_id", item.id)
        .order("created_at", { ascending: true }),
    ]);

    setLikes(likesData?.length ?? 0);
    setLiked(!!likesData?.find((l) => l.member_id === storedMemberId));

    const formatted = (commentsData ?? []).map((c) => ({
      ...c,
      display_name:
        (c.list_members as { display_name: string } | null)?.display_name ?? "?",
    }));
    setComments(formatted);
    setLoadingDetail(false);
  };

  const requireIdentity = (action: "like" | "comment"): boolean => {
    if (memberId) return true;
    setPendingAction(action);
    setNameModalOpen(true);
    return false;
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const { data: member, error } = await supabase
      .from("list_members")
      .insert({ list_id: list.id, display_name: nameInput.trim() })
      .select()
      .single();
    setSavingName(false);
    if (error || !member) return;

    localStorage.setItem(memberKey, member.id);
    setMemberId(member.id);
    setNameModalOpen(false);

    if (pendingAction === "like") doLike(member.id);
    setPendingAction(null);
  };

  const doLike = async (overrideMemberId?: string) => {
    const mid = overrideMemberId ?? memberId;
    if (!selectedItem || !mid) return;

    if (liked) {
      setLiked(false);
      setLikes((n) => Math.max(0, n - 1));
      await supabase
        .from("item_likes")
        .delete()
        .eq("item_id", selectedItem.id)
        .eq("member_id", mid);
    } else {
      setLiked(true);
      setLikes((n) => n + 1);
      await supabase
        .from("item_likes")
        .insert({ item_id: selectedItem.id, member_id: mid });
    }
  };

  const handleLike = () => {
    if (!requireIdentity("like")) return;
    doLike();
  };

  const postComment = async () => {
    if (!commentText.trim() || !selectedItem) return;
    if (!requireIdentity("comment")) return;
    setPostingComment(true);
    const { data: newComment } = await supabase
      .from("item_comments")
      .insert({
        item_id: selectedItem.id,
        member_id: memberId,
        content: commentText.trim(),
      })
      .select("*, list_members(display_name)")
      .single();
    setPostingComment(false);
    if (newComment) {
      setComments((prev) => [
        ...prev,
        {
          ...newComment,
          display_name:
            (newComment.list_members as { display_name: string } | null)
              ?.display_name ?? "?",
        },
      ]);
      setCommentText("");
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedItem.id
            ? { ...item, commentCount: item.commentCount + 1 }
            : item
        )
      );
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 pt-10 pb-6 border-b border-black/10">
        <p className="text-xs font-bold uppercase tracking-widest text-black/40 mb-2">mei</p>
        <h1 className="text-3xl font-bold leading-tight">{list.name}</h1>
        <p className="text-sm text-black/50 mt-1">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <p className="text-2xl font-bold mb-2">nothing here yet</p>
          <p className="text-black/50 text-sm">items will appear here once they're added</p>
        </div>
      ) : (
        <div className="p-6 grid grid-cols-2 gap-4 max-w-lg mx-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openItem(item)}
              className="text-left"
            >
              <div className="relative">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.title ?? ""}
                    width={300}
                    height={375}
                    className="w-full object-cover aspect-[4/5]"
                    unoptimized
                  />
                ) : (
                  <div className="w-full aspect-[4/5] bg-black/5 flex items-center justify-center">
                    <span className="text-4xl text-black/20">🛍</span>
                  </div>
                )}
                {(item.likeCount > 0 || item.commentCount > 0) && (
                  <div className="absolute top-2 left-2 flex gap-1">
                    {item.likeCount > 0 && (
                      <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        ❤️ {item.likeCount}
                      </span>
                    )}
                    {item.commentCount > 0 && (
                      <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                        💬 {item.commentCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                {item.brand && (
                  <p className="text-xs text-black/40 uppercase tracking-wider truncate">
                    {item.brand}
                  </p>
                )}
                {item.title && (
                  <p className="text-sm font-semibold leading-tight line-clamp-2">
                    {item.title}
                  </p>
                )}
                {item.price && (
                  <p className="text-sm text-black/50">${item.price}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Item detail overlay */}
      {selectedItem && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <button
            onClick={() => setSelectedItem(null)}
            className="fixed top-4 left-4 z-10 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-xl shadow-sm"
          >
            ←
          </button>

          {selectedItem.image_url ? (
            <Image
              src={selectedItem.image_url}
              alt={selectedItem.title ?? ""}
              width={600}
              height={750}
              className="w-full object-cover aspect-[4/5]"
              unoptimized
            />
          ) : (
            <div className="w-full aspect-[4/5] bg-black/5 flex items-center justify-center">
              <span className="text-6xl text-black/20">🛍</span>
            </div>
          )}

          <div className="px-6 pt-5 pb-36">
            {selectedItem.brand && (
              <p className="text-xs text-black/40 uppercase tracking-wider mb-1">
                {selectedItem.brand}
              </p>
            )}
            {selectedItem.title && (
              <h2 className="text-xl font-bold leading-snug mb-1">
                {selectedItem.title}
              </h2>
            )}
            {selectedItem.price && (
              <p className="text-base text-black/60 mb-5">${selectedItem.price}</p>
            )}

            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5"
              >
                <span className="text-2xl">{liked ? "❤️" : "🤍"}</span>
                <span className="text-base font-semibold">{likes}</span>
              </button>
              <a
                href={selectedItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 border-2 border-black py-3 text-center font-bold text-sm"
              >
                shop this →
              </a>
            </div>

            <h3 className="text-base font-bold mb-4">
              {loadingDetail
                ? "loading..."
                : comments.length === 0
                ? "no feedback yet"
                : `feedback (${comments.length})`}
            </h3>

            {comments.map((c) => (
              <div key={c.id} className="mb-5">
                <p className="text-xs font-bold text-black/40 uppercase tracking-wider mb-0.5">
                  {c.display_name}
                </p>
                <p className="text-base leading-snug">{c.content}</p>
              </div>
            ))}
          </div>

          {/* Comment input */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 px-4 py-3 flex gap-3 items-center">
            <input
              type="text"
              placeholder="leave feedback..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") postComment();
              }}
              onFocus={(e) => {
                if (!memberId) {
                  e.currentTarget.blur();
                  requireIdentity("comment");
                }
              }}
              className="flex-1 text-base py-2 outline-none placeholder:text-black/30"
            />
            <button
              onClick={postComment}
              disabled={postingComment || !commentText.trim()}
              className="font-bold text-base disabled:opacity-30"
            >
              {postingComment ? "..." : "send"}
            </button>
          </div>
        </div>
      )}

      {/* Name prompt */}
      {nameModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full px-6 pt-6 pb-10">
            <h2 className="text-2xl font-bold mb-2">what&apos;s your name?</h2>
            <p className="text-black/50 text-sm mb-6">
              so your feedback shows up properly
            </p>
            <input
              type="text"
              autoFocus
              placeholder="your name..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
              }}
              className="w-full border-b-2 border-black text-xl pb-2 mb-6 outline-none placeholder:text-black/20"
            />
            <button
              onClick={saveName}
              disabled={savingName || !nameInput.trim()}
              className="w-full bg-black text-white py-4 font-bold text-base disabled:opacity-40"
            >
              {savingName ? "..." : "continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
