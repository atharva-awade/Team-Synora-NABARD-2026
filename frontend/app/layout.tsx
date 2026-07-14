import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { I18nProvider } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Pravah — AI Cash-Flow Intelligence for Rural India",
  description:
    "Pravah predicts cash flow and flags financial risk for rural micro-enterprises using UPI, market and climate signals — explainable, offline-first, privacy-safe.",
  applicationName: "Pravah",
  keywords: ["rural finance", "NABARD", "cash flow prediction", "risk flagging", "SHG", "FPO", "AI"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#060a09" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider>
          <I18nProvider>
            <SmoothScroll>{children}</SmoothScroll>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
