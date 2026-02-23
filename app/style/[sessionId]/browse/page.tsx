"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { Product, SessionItem } from "@/types";
import Button from "@/components/ui/Button";

const GRID_SIZE = 10;
const BUFFER_REFILL_THRESHOLD = 5;

type Slot = { state: "loading" } | { state: "filled"; product: Product } | { state: "empty" };

export default function BrowsePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [slots, setSlots] = useState<Slot[]>(
    Array.from({ length: GRID_SIZE }, () => ({ state: "loading" }))
  );
  const [buffer, setBuffer] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SessionItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [fetchOffset, setFetchOffset] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [friendName, setFriendName] = useState("friend");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (offset: number, currentSeenIds: Set<string>): Promise<Product[]> => {
      const excludeParam = Array.from(currentSeenIds).join(",");
      const url = `/api/items?sessionId=${sessionId}&offset=${offset}${excludeParam ? `&exclude=${excludeParam}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        console.error("fetchProducts error:", data);
        return [];
      }
      return (data.products || []) as Product[];
    },
    [sessionId]
  );

  // Initial load
  useEffect(() => {
    const init = async () => {
      // Load session info
      const sessionRes = await fetch(`/api/sessions/${sessionId}`);
      const sessionData = await sessionRes.json();
      setFriendName(sessionData.session?.friend_name || "friend");

      // Load existing selected items
      const existingItems: SessionItem[] = sessionData.items || [];
      setSelectedItems(existingItems);

      // Fetch initial products
      const products = await fetchProducts(0, new Set());
      const newSeenIds = new Set(products.map((p) => p.id));
      setSeenIds(newSeenIds);
      setFetchOffset(products.length);

      if (products.length === 0) {
        setLoadError("no products found — make sure the catalog has been seeded");
        setSlots(Array.from({ length: GRID_SIZE }, () => ({ state: "empty" as const })));
        return;
      }

      const visible = products.slice(0, GRID_SIZE);
      const buffered = products.slice(GRID_SIZE);

      setSlots(
        visible.map((p) => ({ state: "filled" as const, product: p }))
      );
      setBuffer(buffered);
    };

    init();
  }, [sessionId, fetchProducts]);

  // Background buffer refill
  useEffect(() => {
    if (buffer.length < BUFFER_REFILL_THRESHOLD && !isFetching) {
      setIsFetching(true);
      fetchProducts(fetchOffset, seenIds).then((products) => {
        const newProducts = products.filter((p) => !seenIds.has(p.id));
        setBuffer((prev) => [...prev, ...newProducts]);
        setSeenIds((prev) => {
          const updated = new Set(prev);
          newProducts.forEach((p) => updated.add(p.id));
          return updated;
        });
        setFetchOffset((prev) => prev + products.length);
        setIsFetching(false);
      });
    }
  }, [buffer.length, isFetching, fetchOffset, seenIds, fetchProducts]);

  const addToList = async (product: Product, slotIndex: number) => {
    // Optimistically show loading in slot
    setSlots((prev) => {
      const updated = [...prev];
      updated[slotIndex] = { state: "loading" };
      return updated;
    });

    try {
      // Save to session
      const res = await fetch(`/api/items/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });

      if (res.ok) {
        const item = await res.json();
        setSelectedItems((prev) => [...prev, item]);
      }
    } catch {
      // Non-critical, continue
    }

    // Pull next item from buffer
    setTimeout(() => {
      setSlots((prev) => {
        const updated = [...prev];
        const next = buffer[0];
        if (next) {
          updated[slotIndex] = { state: "filled", product: next };
          setBuffer((b) => b.slice(1));
        } else {
          updated[slotIndex] = { state: "empty" };
        }
        return updated;
      });
    }, 300);
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    const nextTen = buffer.slice(0, GRID_SIZE);
    setBuffer((prev) => prev.slice(GRID_SIZE));

    if (nextTen.length > 0) {
      setSlots(
        nextTen.map((p) => ({ state: "filled" as const, product: p }))
      );
      // Pad remaining with loading states if buffer was small
      if (nextTen.length < GRID_SIZE) {
        setSlots((prev) => {
          const padded = [...prev];
          for (let i = nextTen.length; i < GRID_SIZE; i++) {
            padded[i] = { state: "loading" };
          }
          return padded;
        });
      }
    } else {
      // No buffer — show all as loading, fetch new batch
      setSlots(Array.from({ length: GRID_SIZE }, () => ({ state: "loading" })));
      const products = await fetchProducts(fetchOffset, seenIds);
      const newProducts = products.filter((p) => !seenIds.has(p.id));
      setSeenIds((prev) => {
        const updated = new Set(prev);
        newProducts.forEach((p) => updated.add(p.id));
        return updated;
      });
      setFetchOffset((prev) => prev + products.length);
      setSlots(
        newProducts.slice(0, GRID_SIZE).map((p) => ({ state: "filled" as const, product: p }))
      );
      setBuffer(newProducts.slice(GRID_SIZE));
    }

    setIsRefreshing(false);
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Toolbar */}
      <header className="sticky top-0 z-20 bg-white border-b border-black/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-heading font-black text-lg">
              {friendName}&apos;s list
            </span>
            {selectedItems.length > 0 && (
              <span className="font-body text-sm text-black/50">
                {selectedItems.length} added
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="font-body text-sm px-3 py-1.5 border border-black/20 hover:border-black transition-colors disabled:opacity-40"
            >
              {isRefreshing ? "refreshing..." : "↻ refresh"}
            </button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/style/${sessionId}/review`)}
              disabled={selectedItems.length === 0}
            >
              done ({selectedItems.length})
            </Button>
          </div>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
        {loadError && (
          <p className="font-body text-sm text-red-500 mb-4">{loadError}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {slots.map((slot, i) => (
            <ProductSlot
              key={i}
              slot={slot}
              onAdd={(product) => addToList(product, i)}
              alreadySelected={
                slot.state === "filled"
                  ? selectedItems.some((s) => s.product_id === slot.product.id)
                  : false
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ProductSlot({
  slot,
  onAdd,
  alreadySelected,
}: {
  slot: Slot;
  onAdd: (product: Product) => void;
  alreadySelected: boolean;
}) {
  if (slot.state === "loading") {
    return (
      <div className="aspect-[3/4] bg-black/5 animate-pulse" />
    );
  }

  if (slot.state === "empty") {
    return <div className="aspect-[3/4] bg-black/5" />;
  }

  const { product } = slot;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => !alreadySelected && onAdd(product)}
      disabled={alreadySelected}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden text-left",
        alreadySelected ? "opacity-50 cursor-default" : "cursor-pointer"
      )}
    >
      {/* Product image */}
      <div className="relative w-full h-full">
        <Image
          src={product.image_url}
          alt={product.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        />
      </div>

      {/* Hover overlay */}
      {!alreadySelected && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end">
          <div className="w-full p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
            <span className="font-heading font-bold text-white text-sm block">
              + add to list
            </span>
          </div>
        </div>
      )}

      {/* Already added badge */}
      {alreadySelected && (
        <div className="absolute top-2 right-2 bg-[#7C3AED] text-white font-heading font-bold text-xs px-2 py-1">
          ✓
        </div>
      )}

      {/* Product info */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-2">
        <p className="font-body text-xs text-black/50 truncate">{product.brand_name}</p>
        <p className="font-heading font-semibold text-xs truncate leading-tight">
          {product.title}
        </p>
        {product.price && (
          <p className="font-body text-xs text-black/70">
            {formatPrice(product.price, product.currency)}
          </p>
        )}
      </div>
    </motion.button>
  );
}
