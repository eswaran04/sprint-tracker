import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VisitorAnalytics } from "@/components/analytics";
import { Providers } from "@/components/providers";
import { accentInitScript, DEFAULT_ACCENT } from "@/lib/accents";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Absolute base for OG/Twitter image URLs. Not derived from request.url: behind App Hosting's proxy that carries the
// container's internal origin (see src/lib/redirect.ts).
function siteUrl() {
  try {
    return new URL(process.env.SITE_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Sprintboard — DSA sprint tracker",
  description: "Upload your prep sheet, track every problem, and stay on schedule.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-accent={DEFAULT_ACCENT} suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accentInitScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <VisitorAnalytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
