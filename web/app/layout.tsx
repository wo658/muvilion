import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { tokenCss } from "@/lib/ui/tokens";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "muvilion",
  icons: { icon: { url: "/mascot/muvi-face.svg", type: "image/svg+xml" } },
  description: "Turn floor plans into editable spaces. Review drawing evidence and design with Muse.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${inter.variable} ${plexMono.variable} h-full antialiased`}>
      <head>
        {/* design tokens (lib/ui/tokens.ts) as CSS variables */}
        <style dangerouslySetInnerHTML={{ __html: tokenCss() }} />
      </head>
      <body className="flex min-h-full flex-col"><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
