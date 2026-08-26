import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoveU",
  description: "逐片段拆分剧本，创作高密度AI视频提示词",
  icons: {icon: "/favicon.svg"},
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
