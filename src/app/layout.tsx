import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { CookingModeProvider } from "@/context/CookingModeContext";

export const metadata: Metadata = {
  title: "AI Cooking",
  description: "Smart recipe generator from your receipts",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff7849",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <CookingModeProvider>
          <div className="container">
            {children}
          </div>
          <BottomNav />
        </CookingModeProvider>
      </body>
    </html>
  );
}
