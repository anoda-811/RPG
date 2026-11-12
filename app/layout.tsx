import type { Metadata } from "next";
import { DotGothic16 } from "next/font/google";
import "./globals.css";

/** 16bit風のドットフォント（日本語対応） */
const dotFont = DotGothic16({
  weight: "400",
  variable: "--font-dot",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "紅蓮の火山 ～炎龍の祭壇～",
  description: "スーパーファミコン風の2Dドット絵RPG デモ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${dotFont.variable} h-full`}>
      <body className="min-h-full bg-black text-[#f4f1ea] antialiased">{children}</body>
    </html>
  );
}
