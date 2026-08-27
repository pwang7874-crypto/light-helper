import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "别穿帮灯光助手 V3｜片场灯光连续性计算器";
const description =
  "对照上一镜人物与环境光，按真实灯具型号给出功率、色温、距离和环境补光目标。";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3002";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ||
    host.startsWith("127.") ||
    host.startsWith("[::1]")
      ? "http"
      : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();
  return {
    metadataBase,
    title,
    description,
    manifest: "/manifest.webmanifest",
    applicationName: "别穿帮灯光助手",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "别穿帮灯光",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: "/app-icon.svg",
      shortcut: "/app-icon.svg",
      apple: "/app-icon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

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
