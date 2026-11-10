import { ChartColumn, File, MessageSquare, PanelsTopLeft, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Ask", href: "/ask", icon: MessageSquare },
  { label: "Documents", href: "/documents", icon: File },
  { label: "Extract", href: "/extract", icon: PanelsTopLeft },
  { label: "Admin", href: "/admin", icon: ChartColumn },
];
