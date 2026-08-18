import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "别穿帮灯光助手",
  description: "拍摄现场直接告诉你哪盏灯开几档、调多少色温。",
  manifest: "/manifest.webmanifest",
  applicationName: "别穿帮灯光助手",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "别穿帮灯光",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#667765",
  colorScheme: "light",
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
