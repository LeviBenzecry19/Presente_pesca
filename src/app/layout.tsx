import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BackgroundTasks } from "@/components/BackgroundTasks";
import { ProfileGate } from "@/components/profiles/ProfileGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: { default: "Pesca", template: "%s · Pesca" },
  description: "Planeje a pescaria, acompanhe o clima e registre capturas — mesmo sem sinal.",
  applicationName: "Pesca",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pesca" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a6b95" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <ProfileGate>{children}</ProfileGate>
        <ServiceWorkerRegister />
        <BackgroundTasks />
      </body>
    </html>
  );
}
