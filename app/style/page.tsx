"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Button from "@/components/ui/Button";

export default function StyleStartPage() {
  const router = useRouter();
  const [friendName, setFriendName] = useState("");
  const [stylistName, setStylistName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friend_name: friendName.trim(),
          stylist_name: stylistName.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to create session");

      const session = await res.json();
      router.push(`/style/${session.id}/onboarding`);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <button
          onClick={() => router.push("/")}
          className="font-heading text-xl font-black mb-16 block hover:text-[#7C3AED] transition-colors"
        >
          mei
        </button>

        <h1 className="font-heading text-4xl sm:text-5xl font-black leading-tight mb-12">
          who are you styling?
        </h1>

        <form onSubmit={handleStart} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="font-body text-sm font-medium text-black/60">
              friend&apos;s name
            </label>
            <input
              type="text"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="e.g. Maya"
              autoFocus
              className="font-heading text-2xl font-bold border-b-2 border-black bg-transparent outline-none pb-2 placeholder:text-black/20 focus:border-[#7C3AED] transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-body text-sm font-medium text-black/60">
              your name (optional)
            </label>
            <input
              type="text"
              value={stylistName}
              onChange={(e) => setStylistName(e.target.value)}
              placeholder="e.g. Stella"
              className="font-heading text-2xl font-bold border-b-2 border-black/20 bg-transparent outline-none pb-2 placeholder:text-black/20 focus:border-black transition-colors"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-red-500">{error}</p>
          )}

          <div className="mt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!friendName.trim() || loading}
            >
              {loading ? "starting..." : "start styling"}
            </Button>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
