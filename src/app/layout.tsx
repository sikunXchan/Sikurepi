import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import CookingCheerBear from "@/components/CookingCheerBear";
import SyncManager from "@/components/SyncManager";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AuthProvider } from "@/lib/auth/AuthContext";

export const metadata: Metadata = {
  title: "Sikurepi",
  description: "Smart recipe generator from your receipts",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6f91",
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
        <AuthProvider>
          <LanguageProvider>
            <LanguageToggle />
            <div className="container">
              {children}
            </div>
            <BottomNav />
            <CookingCheerBear />
            <SyncManager />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
