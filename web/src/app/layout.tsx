import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sofon — Uptime Monitoring",
    template: "%s · Sofon",
  },
  description:
    "Self-hosted uptime monitoring. Get instant alerts when your services go down.",
  metadataBase: new URL("https://sofon.app"),
  openGraph: {
    type: "website",
    siteName: "Sofon",
    title: "Sofon — Uptime Monitoring",
    description:
      "Self-hosted uptime monitoring. Get instant alerts when your services go down.",
  },
  twitter: {
    card: "summary",
    title: "Sofon — Uptime Monitoring",
    description:
      "Self-hosted uptime monitoring. Get instant alerts when your services go down.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
