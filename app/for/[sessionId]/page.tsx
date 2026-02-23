"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import Image from "next/image";
import type { Session, SessionItem } from "@/types";
import { formatPrice } from "@/lib/utils";

type SwipeDecision = "yes" | "no";

export default function SwipePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, SwipeDecision>>({});

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setSession(d.session);
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [sessionId]);

  const recordSwipe = async (itemId: string, decision: SwipeDecision) => {
    setDecisions((prev) => ({ ...prev, [itemId]: decision }));
    // Fire-and-forget
    fetch("/api/swipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, item_id: itemId, decision }),
    }).catch(() => {});
  };

  const handleSwipe = (decision: SwipeDecision) => {
    const item = items[currentIndex];
    if (!item) return;
    recordSwipe(item.id, decision);
    if (currentIndex + 1 >= items.length) {
      // All done — navigate to results
      setTimeout(() => {
        router.push(`/for/${sessionId}/results`);
      }, 400);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="font-body text-black/40">loading your list...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="font-heading text-2xl font-black mb-3">link not found</h1>
          <p className="font-body text-black/50">
            This link doesn&apos;t work. Check with the person who sent it.
          </p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6 text-center">
        <div>
          <h1 className="font-heading text-2xl font-black mb-3">no items yet</h1>
          <p className="font-body text-black/50">
            {session.stylist_name || "Your friend"} hasn&apos;t added anything to your list yet.
          </p>
        </div>
      </div>
    );
  }

  // Entry screen
  if (!started) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-heading text-4xl sm:text-5xl font-black mb-4 leading-tight">
            hey {session.friend_name}
          </h1>
          {session.stylist_name && (
            <p className="font-body text-lg text-black/60 mb-2">
              {session.stylist_name} picked these looks for you.
            </p>
          )}
          <p className="font-body text-base text-black/40 mb-10">
            swipe right on your favorites.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="font-heading font-black text-lg px-8 py-4 bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors active:scale-[0.97]"
          >
            let&apos;s go →
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between max-w-sm mx-auto w-full">
        <span className="font-heading font-black text-sm">mei</span>
        <span className="font-body text-sm text-black/40">
          {currentIndex + 1} of {items.length}
        </span>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="relative w-full max-w-sm" style={{ height: "70vh" }}>
          {/* Show current + next card */}
          {[...items].reverse().map((item, reversedIndex) => {
            const actualIndex = items.length - 1 - reversedIndex;
            if (actualIndex < currentIndex || actualIndex > currentIndex + 1) return null;
            const isTop = actualIndex === currentIndex;
            return (
              <SwipeCard
                key={item.id}
                item={item}
                isTop={isTop}
                onSwipe={isTop ? handleSwipe : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="pb-10 flex justify-center gap-8">
        <button
          onClick={() => handleSwipe("no")}
          className="w-16 h-16 rounded-full border-2 border-black/20 flex items-center justify-center text-2xl hover:border-black hover:scale-105 transition-all"
        >
          ✕
        </button>
        <button
          onClick={() => handleSwipe("yes")}
          className="w-16 h-16 rounded-full bg-[#7C3AED] flex items-center justify-center text-2xl text-white hover:bg-[#6D28D9] hover:scale-105 transition-all"
        >
          ♥
        </button>
      </div>
    </div>
  );
}

function SwipeCard({
  item,
  isTop,
  onSwipe,
}: {
  item: SessionItem;
  isTop: boolean;
  onSwipe?: (decision: SwipeDecision) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const yesOpacity = useTransform(x, [20, 100], [0, 1]);
  const noOpacity = useTransform(x, [-100, -20], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const THRESHOLD = 120;
    if (info.offset.x > THRESHOLD) {
      onSwipe?.("yes");
    } else if (info.offset.x < -THRESHOLD) {
      onSwipe?.("no");
    }
    // Otherwise snap back (handled by drag constraints reset)
  };

  return (
    <motion.div
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: isTop ? 1 : 0.96,
        zIndex: isTop ? 10 : 5,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
      animate={isTop ? {} : { scale: 0.96 }}
      className="absolute inset-0 rounded-none overflow-hidden bg-white shadow-lg cursor-grab active:cursor-grabbing"
    >
      {/* Image */}
      <div className="relative h-3/4 w-full">
        <Image
          src={item.image_url}
          alt={item.title}
          fill
          className="object-cover"
          draggable={false}
          priority={isTop}
          sizes="(max-width: 640px) 100vw, 384px"
        />

        {/* YES / NO overlays */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: yesOpacity }}
              className="absolute top-6 left-6 font-heading font-black text-3xl text-[#7C3AED] border-4 border-[#7C3AED] px-3 py-1 rotate-[-12deg]"
            >
              YES
            </motion.div>
            <motion.div
              style={{ opacity: noOpacity }}
              className="absolute top-6 right-6 font-heading font-black text-3xl text-black border-4 border-black px-3 py-1 rotate-[12deg]"
            >
              NO
            </motion.div>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-4 h-1/4 flex flex-col justify-center">
        <p className="font-body text-xs text-black/50">{item.brand_name}</p>
        <p className="font-heading font-bold text-base leading-tight">{item.title}</p>
        {item.price && (
          <p className="font-body text-sm text-black/60 mt-0.5">
            {formatPrice(item.price, item.currency)}
          </p>
        )}
        <a
          href={item.product_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-body text-xs text-[#7C3AED] mt-1 hover:underline"
        >
          view item →
        </a>
      </div>
    </motion.div>
  );
}
