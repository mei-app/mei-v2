import type { QuizAnswers } from "@/types";

export type QuizQuestionId = keyof QuizAnswers;

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  id: QuizQuestionId;
  label: (friendName: string) => string;
  sublabel?: (friendName: string) => string;
  options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "vibe",
    label: (name) => `What's ${name}'s overall vibe?`,
    sublabel: (name) => `Pick everything that feels like ${name}.`,
    options: [
      { value: "clean-girl", label: "Clean girl" },
      { value: "streetwear", label: "Streetwear" },
      { value: "beachy", label: "Beachy" },
      { value: "old-money", label: "Old money" },
      { value: "maximalist", label: "Maximalist" },
      { value: "dark-academia", label: "Dark academia" },
    ],
  },
  {
    id: "fit",
    label: (name) => `What fits does ${name} gravitate toward?`,
    options: [
      { value: "oversized", label: "Oversized & relaxed" },
      { value: "fitted", label: "Fitted & tailored" },
      { value: "flowy", label: "Flowy & feminine" },
      { value: "structured", label: "Structured & boxy" },
      { value: "mini", label: "Mini" },
      { value: "maxi", label: "Maxi" },
    ],
  },
  {
    id: "colors",
    label: (name) => `What colors does ${name} actually wear?`,
    options: [
      { value: "neutrals", label: "Neutrals" },
      { value: "earth-tones", label: "Earth tones" },
      { value: "pastels", label: "Pastels" },
      { value: "bold", label: "Bold colors" },
      { value: "monochrome", label: "Monochrome" },
      { value: "prints", label: "Prints & patterns" },
    ],
  },
  {
    id: "occasion",
    label: (name) => `What's the occasion for ${name}'s new looks?`,
    options: [
      { value: "everyday", label: "Everyday / casual" },
      { value: "work", label: "Work / office" },
      { value: "going-out", label: "Going out" },
      { value: "special", label: "Special occasion" },
      { value: "all-of-it", label: "A bit of everything" },
    ],
  },
  {
    id: "budget",
    label: (name) => `What's ${name}'s usual spend per piece?`,
    options: [
      { value: "under-50", label: "Under $50" },
      { value: "50-100", label: "$50 – $100" },
      { value: "100-200", label: "$100 – $200" },
      { value: "200-plus", label: "$200+" },
    ],
  },
  {
    id: "avoid",
    label: (name) => `Anything ${name} would never wear?`,
    sublabel: () => "Honest answers only.",
    options: [
      { value: "animal-print", label: "Animal print" },
      { value: "loud-logos", label: "Loud logos" },
      { value: "sheer", label: "Sheer / see-through" },
      { value: "athleisure", label: "Athleisure" },
      { value: "nothing", label: "Nothing — she's open to anything" },
    ],
  },
];
