import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { ToastProvider } from "@/components/ui/Toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BINBYB – Crypto Trading Bot",
  description: "Mobile-first crypto trading bot PWA",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen w-full max-w-[100vw] overflow-x-hidden antialiased">
        <ToastProvider>
          <div
            data-layout
            className="flex min-h-[100dvh] w-full max-w-[100vw] flex-col overflow-x-hidden"
          >
            <Header />
            <main className="flex-1 w-full max-w-[100vw] overflow-x-hidden pb-20 md:pb-6 pt-14">
              {children}
            </main>
            <BottomNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
