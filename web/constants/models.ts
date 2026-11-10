import { Asterisk, Cpu, Sparkle, type LucideIcon } from "lucide-react";
import type { Provider } from "@/types/api";

/** How each answer-model provider is shown on the model chip. */
export const PROVIDERS: Record<Provider, { label: string; icon: LucideIcon }> = {
  anthropic: { label: "Anthropic", icon: Asterisk },
  openai: { label: "OpenAI", icon: Sparkle },
  ollama: { label: "Ollama", icon: Cpu },
};
