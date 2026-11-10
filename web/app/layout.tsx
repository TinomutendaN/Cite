import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Ask your company's documents and see the exact source for every answer. A demo loaded with sample HR policies, contracts and patient materials. No sign-up.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Cite: answers with sources from your company documents",
    template: "%s · Cite",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Cite",
    title: "Cite: answers with sources from your company documents",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cite: answers with sources from your company documents",
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
