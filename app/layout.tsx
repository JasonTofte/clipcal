import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Graduate, Fredoka } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const graduate = Graduate({
  variable: "--font-graduate",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipCal",
  description: "Your campus copilot. Snap a flyer, know if you should go.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "ClipCal",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7A0019",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${graduate.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-[calc(env(safe-area-inset-bottom)+56px)]">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
