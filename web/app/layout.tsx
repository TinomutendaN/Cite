import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cite",
  description: "Answers from your company documents, with the exact source for every answer.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
