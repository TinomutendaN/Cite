import { Asterisk, Cpu, Sparkle, type LucideIcon } from "lucide-react";
import type { Provider } from "@/types/api";

/** Order of the options on the Admin page's model switch. */
export const PROVIDER_ORDER: Provider[] = ["openai", "anthropic", "ollama"];

/**
 * How each answer-model provider is shown: `label` and `icon` on the Ask page's
 * model chip; `adminLabel`, `description` and `chipColor` on the Admin page.
 */
export const PROVIDERS: Record<
  Provider,
  { label: string; icon: LucideIcon; adminLabel: string; description: string; chipColor: string }
> = {
  anthropic: {
    label: "Anthropic",
    icon: Asterisk,
    adminLabel: "Anthropic",
    description: "Cloud model, paid per question",
    chipColor: "#F0D3B3",
  },
  openai: {
    label: "OpenAI",
    icon: Sparkle,
    adminLabel: "OpenAI",
    description: "Cloud model, paid per question",
    chipColor: "#E3E7E5",
  },
  ollama: {
    label: "Ollama",
    icon: Cpu,
    adminLabel: "Local model",
    description: "Runs on our own server, no per-question cost",
    chipColor: "#E9E1D3",
  },
};
