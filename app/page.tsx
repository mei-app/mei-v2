"use client";

import { motion, type Variants } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Button from "@/components/ui/Button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const steps = [
  "send the mei link to friends for them to style you, or go to mei and choose a friend to style",
  "start with the onboarding process to choose styles and aesthetics you think your friend will love",
  "get personalized recommendations",
  "select the items you would love to see your friend wear, and add to your list",
  "review your list",
  "hit the send button to send a link back to your friend with their personalized list!",
  "your friend can now view your list and select which items they also love",
];

interface FeaturedProduct {
  id: string;
  image_url: string;
  title: string;
  brand_name: string;
}

function ImageColumn({ images, offset }: { images: FeaturedProduct[]; offset: number }) {
  return (
    <div
      className="flex flex-col gap-2 flex-1 opacity-70"
      style={{ transform: `translateY(${offset}px)` }}
    >
      {images.map((p) => (
        <div
          key={p.id}
          className="relative aspect-[3/4] w-full overflow-hidden bg-black/5 shrink-0"
        >
          <Image
            src={p.image_url}
            alt={p.title}
            fill
            className="object-cover"
            sizes="8vw"
          />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    fetch("/api/featured")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Distribute 24 images across 6 columns (3 left, 3 right), 4 per column
  const cols = Array.from({ length: 6 }, (_, i) =>
    products.slice(i * 4, i * 4 + 4)
  );
  const offsets = [-20, 12, -8, 8, -12, 20]; // vertical offsets per column

  return (
    <main className="bg-white text-black overflow-x-hidden">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-center">
          <span className="font-heading text-2xl font-black tracking-tight">mei</span>
        </div>
      </header>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">

        {/* Desktop: flanking image columns */}
        {products.length > 0 && (
          <div className="hidden md:flex absolute inset-0 pointer-events-none select-none">
            {/* Left 3 columns */}
            <div className="flex gap-2 w-[38%] overflow-hidden pr-2">
              {cols.slice(0, 3).map((col, i) => (
                <ImageColumn key={i} images={col} offset={offsets[i]} />
              ))}
            </div>

            {/* Center gap (text lives here — kept clear) */}
            <div className="flex-1" />

            {/* Right 3 columns */}
            <div className="flex gap-2 w-[38%] overflow-hidden pl-2">
              {cols.slice(3, 6).map((col, i) => (
                <ImageColumn key={i} images={col} offset={offsets[i + 3]} />
              ))}
            </div>

            {/* Radial fade: white center, transparent edges */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 50% 85% at 50% 50%, white 35%, rgba(255,255,255,0.85) 55%, transparent 100%)",
              }}
            />
          </div>
        )}

        {/* Mobile: faded grid background */}
        {products.length > 0 && (
          <div className="md:hidden absolute inset-0 pointer-events-none select-none">
            <div className="grid grid-cols-3 gap-1 absolute inset-0 opacity-25">
              {products.slice(0, 9).map((p) => (
                <div key={p.id} className="relative overflow-hidden bg-black/5">
                  <Image src={p.image_url} alt={p.title} fill className="object-cover" sizes="33vw" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-white/60" />
          </div>
        )}

        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center px-6 flex flex-col items-center"
        >
          <h1 className="font-heading text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight">
            you style friends
          </h1>
          <h1 className="font-heading text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight mt-2">
            friends style you
          </h1>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            className="mt-8"
          >
            <button
              onClick={() => router.push("/style")}
              className="font-heading font-bold text-base tracking-tight flex items-center gap-1.5 hover:gap-3 transition-all duration-200"
            >
              try it out <span aria-hidden>→</span>
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
        >
          <h2 className="font-heading text-4xl sm:text-5xl font-black mb-14">
            how it works
          </h2>
        </motion.div>

        <motion.ol
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="space-y-7"
        >
          {steps.map((step, i) => (
            <motion.li key={i} variants={fadeUp} className="flex gap-5">
              <span className="font-heading font-black text-3xl text-black/15 w-9 shrink-0 leading-none mt-0.5">
                {i + 1}
              </span>
              <span className="font-body text-base leading-relaxed">
                {step}
              </span>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      {/* CLOSING PHRASE */}
      <section className="px-6 py-24 text-center">
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="font-heading text-3xl sm:text-4xl md:text-5xl font-black max-w-2xl mx-auto leading-tight"
        >
          get clothing recommendations from friends you trust
        </motion.p>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32 flex flex-col items-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="flex flex-col items-center gap-3 w-full max-w-xs"
        >
          <motion.div variants={fadeUp} className="w-full">
            <Button variant="outline" size="lg" onClick={handleCopyLink}>
              {copied ? "link copied!" : "send mei to friends"}
            </Button>
          </motion.div>

          <motion.span variants={fadeUp} className="font-body text-sm text-black/40">
            or
          </motion.span>

          <motion.div variants={fadeUp} className="w-full">
            <Button variant="primary" size="lg" onClick={() => router.push("/style")}>
              go to mei
            </Button>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
