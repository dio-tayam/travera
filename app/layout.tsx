import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/shared/i18n-provider";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-bricolage",
  display: "swap",
});

const sans = Onest({
  subsets: ["latin"],
  variable: "--font-onest",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Travera — Plan it. Share it. Live it.",
    template: "%s · Travera",
  },
  description: "Travera is your collaborative travel planning companion. Plan it. Share it. Live it.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Travera — Plan it. Share it. Live it.",
    description: "Your collaborative travel planning companion",
    siteName: "Travera",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Flags that JS is running, so scroll-reveal styles never hide content when it isn't. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
