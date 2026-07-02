import BackToTop from "../components/BackToTop"; 
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "../components/Header";
import AIChatbot from "../components/AIChatbot";
import OfflineIndicator from "../components/OfflineIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CropChain - Supply Chain Track & Trace",
  description: "Secure, decentralized tracking and trace solution for agriculture crop supply chains.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-green-50/40 to-blue-50/40 dark:from-black dark:to-black text-foreground transition-colors duration-200">
            <OfflineIndicator />
            <Header />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
            <BackToTop />
            <AIChatbot />
          </div>
        </Providers>
      </body>
    </html>
  );
}
