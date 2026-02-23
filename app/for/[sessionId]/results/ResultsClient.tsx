"use client";

import { useState, useEffect, use } from "react";
import { motion, type Variants } from "framer-motion";
import Image from "next/image";
import type { Session, SessionItem } from "@/types";
import { formatPrice } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ResultsClient({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [likedItems, setLikedItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // Get session + all items
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      const { session: s, items }: { session: Session; items: SessionItem[] } =
        await sessionRes.json();
      setSession(s);

      // Get swipe results (yes only)
      const { data: swipes } = await supabase
        .from("swipe_results")
        .select("item_id, decision")
        .eq("session_id", sessionId)
        .eq("decision", "yes");

      const likedIds = new Set((swipes || []).map((sw: { item_id: string }) => sw.item_id));
      setLikedItems((items || []).filter((item) => likedIds.has(item.id)));
      setLoading(false);
    };

    load();
  }, [sessionId]);

  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const stylistName = session?.stylist_name;
    const title = stylistName
      ? `here's what i loved from your mei list`
      : `here's what i loved on mei`;
    const text = stylistName
      ? `${stylistName}, here are the looks i loved from the list you made me!`
      : `here are the looks i loved on mei!`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="font-body text-black/40">loading your results...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Done heading */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="text-center mb-12"
        >
          <h1 className="font-heading text-5xl font-black mb-3">you&apos;re done!</h1>
          {likedItems.length > 0 ? (
            <>
              <p className="font-body text-black/60 mb-2">
                here&apos;s what you loved.
              </p>
              <p className="font-body text-sm text-black/40">
                save this page or screenshot it — it&apos;s your wishlist.
              </p>
            </>
          ) : (
            <p className="font-body text-black/60">
              looks like nothing caught your eye this time.
            </p>
          )}
        </motion.div>

        {/* Send results back CTA */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mb-10 p-5 border-2 border-black text-center"
        >
          <p className="font-heading font-bold text-sm mb-3">
            {session?.stylist_name ? `send results to ${session.stylist_name}` : "share your results"}
          </p>
          <button
            onClick={handleShare}
            className="font-heading font-black text-base px-6 py-3 bg-black text-white hover:bg-[#7C3AED] transition-colors"
          >
            {shared ? "link copied!" : "share my results"}
          </button>
        </motion.div>

        {/* Liked items grid */}
        {likedItems.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            {likedItems.map((item) => (
              <a
                key={item.id}
                href={item.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="mt-2">
                  <p className="font-body text-xs text-black/50">{item.brand_name}</p>
                  <p className="font-heading font-semibold text-xs leading-tight">{item.title}</p>
                  {item.price && (
                    <p className="font-body text-xs text-black/60">
                      {formatPrice(item.price, item.currency)}
                    </p>
                  )}
                  <p className="font-body text-xs text-[#7C3AED] group-hover:underline mt-0.5">
                    shop →
                  </p>
                </div>
              </a>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  );
}
