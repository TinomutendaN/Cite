import { ChartColumn, FileSearch, FolderOpen, MessageSquare, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Ask", href: "/ask", icon: MessageSquare },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Extract", href: "/extract", icon: FileSearch },
  { label: "Admin", href: "/admin", icon: ChartColumn },
];
