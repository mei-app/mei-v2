"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import type { Session, SessionItem } from "@/types";
import { formatPrice } from "@/lib/utils";
import Button from "@/components/ui/Button";

export default function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setSession(d.session);
        setItems(d.items || []);
        setLoading(false);
      });
  }, [sessionId]);

  const removeItem = async (itemId: string) => {
    const res = await fetch(`/api/items/${sessionId}?itemId=${itemId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    }
  };

  const handleSend = async () => {
    setSending(true);
    const link = `${window.location.origin}/for/${sessionId}`;
    try {
      // Mark session as sent
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });

      // Try native share first (mobile)
      if (navigator.share) {
        await navigator.share({
          title: `${session?.stylist_name || "Someone"} styled you on Mei`,
          text: `${session?.friend_name}, check out the looks I picked for you!`,
          url: link,
        });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // fallback: just copy
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-body text-black/40">loading...</p>
      </div>
    );
  }

  const friendName = session?.friend_name || "friend";

  return (
    <main className="min-h-screen bg-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <button
            onClick={() => router.push(`/style/${sessionId}/browse`)}
            className="font-body text-sm text-black/40 hover:text-black mb-6 block transition-colors"
          >
            ← back to browsing
          </button>
          <h1 className="font-heading text-4xl font-black">
            {friendName}&apos;s list
          </h1>
          <p className="font-body text-black/50 mt-1">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </motion.div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-heading text-xl font-bold text-black/30">nothing added yet</p>
            <Button
              variant="outline"
              size="md"
              className="mt-6"
              onClick={() => router.push(`/style/${sessionId}/browse`)}
            >
              go back to browse
            </Button>
          </div>
        ) : (
          <>
            {/* Items grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-12">
              {items.map((item) => (
                <div key={item.id} className="relative group">
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <Image
                      src={item.image_url}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, 33vw"
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-1.5 px-0.5">
                    <p className="font-body text-xs text-black/50">{item.brand_name}</p>
                    <p className="font-heading font-semibold text-xs leading-tight truncate">
                      {item.title}
                    </p>
                    {item.price && (
                      <p className="font-body text-xs text-black/60">
                        {formatPrice(item.price, item.currency)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Send panel */}
            <div className="border-t border-black/10 pt-8">
              <h2 className="font-heading text-2xl font-black mb-2">
                ready to send?
              </h2>
              <p className="font-body text-sm text-black/50 mb-6">
                {friendName} will get a link to swipe through everything you picked.
              </p>

              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-body text-sm text-[#7C3AED] mb-4"
                >
                  link copied! send it to {friendName} 🎉
                </motion.p>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? "sending..." : `send list to ${friendName}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
