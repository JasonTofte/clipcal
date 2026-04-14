import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Atkinson_Hyperlegible, Plus_Jakarta_Sans } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { GoldyHeader } from "@/components/goldy-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Primary body/UI font. Atkinson Hyperlegible is designed by the
// Braille Institute specifically for low-vision and neurodivergent
// readers — distinct letterforms, high differentiation between
// similar glyphs (I/l/1, 0/O). Evidence-backed choice for ADHD users
// per A11y Collective + BDA 2024 guidance.
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Display/heading font. Plus Jakarta Sans Extra Bold matches the tight,
// geometric boldness seen in modern mobile app UIs.
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-fredoka",
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShowUp",
  description: "Your campus copilot. Snap a flyer, know if you should go.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "ShowUp",
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
      className={`${geistSans.variable} ${geistMono.variable} ${atkinson.variable} ${jakartaSans.variable} h-full antialiased`}
    >
      <body
        className="min-h-dvh flex flex-col pb-[calc(env(safe-area-inset-bottom)+56px)]"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <GoldyHeader />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
