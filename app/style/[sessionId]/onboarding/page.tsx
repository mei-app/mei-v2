"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { QUIZ_QUESTIONS } from "@/lib/quiz";
import type { QuizAnswers } from "@/types";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [saving, setSaving] = useState(false);
  const [friendName, setFriendName] = useState<string | null>(null);

  // Fetch friend name on mount
  useState(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => setFriendName(d.session?.friend_name || "your friend"));
  });

  const question = QUIZ_QUESTIONS[step];
  const name = friendName || "your friend";
  const selectedValues = (answers[question.id] || []) as string[];
  const isLast = step === QUIZ_QUESTIONS.length - 1;
  const totalSteps = QUIZ_QUESTIONS.length;

  const toggleOption = (value: string) => {
    const current = selectedValues;
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setAnswers((prev) => ({ ...prev, [question.id]: updated }));
  };

  const handleNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    setSaving(true);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_answers: answers }),
      });
      router.push(`/style/${sessionId}/browse`);
    } catch {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <main className="min-h-screen bg-white flex flex-col px-6 py-8">
      {/* Progress bar */}
      <div className="w-full max-w-xl mx-auto mb-10">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-0.5 flex-1 transition-all duration-300",
                i <= step ? "bg-black" : "bg-black/15"
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col max-w-xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col flex-1"
          >
            <h1 className="font-heading text-3xl sm:text-4xl font-black leading-tight mb-2">
              {question.label(name)}
            </h1>
            {question.sublabel && (
              <p className="font-body text-sm text-black/50 mb-8">
                {question.sublabel(name)}
              </p>
            )}
            {!question.sublabel && <div className="mb-8" />}

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((option) => {
                const selected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      "px-4 py-4 text-left font-heading font-semibold text-sm border-2 transition-all duration-150 active:scale-[0.97]",
                      selected
                        ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                        : "border-black/10 bg-white text-black hover:border-black"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="max-w-xl mx-auto w-full mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="ghost" size="md" onClick={handleBack} className="flex-1">
            ← back
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleNext}
          disabled={saving}
          className="flex-1"
        >
          {saving ? "saving..." : isLast ? "find clothes →" : "next →"}
        </Button>
      </div>
    </main>
  );
}
