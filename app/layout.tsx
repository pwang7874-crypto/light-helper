import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "别穿帮灯光助手",
  description: "拍摄现场直接告诉你哪盏灯开几档、调多少色温。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
