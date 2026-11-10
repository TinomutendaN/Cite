import type { Category } from "@/types/api";

export interface StarterQuestion {
  question: string;
  category: Category;
}

// From data/documents/DEMO_QUESTIONS.md: one per category, each checked with
// `python -m app.check` to be answered and cited from the right document.
export const STARTER_QUESTIONS: StarterQuestion[] = [
  { question: "How many days of PTO do new employees get?", category: "policies" },
  { question: "What should I do if I'm sick for a week?", category: "policies" },
  { question: "How fast will my care team reply to a portal message?", category: "patient-materials" },
  { question: "When does the Brightline supply contract renew?", category: "contracts" },
];
