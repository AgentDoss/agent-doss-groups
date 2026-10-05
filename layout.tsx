import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGENT DOSS GROUPS",
  description: "Votre équipe IA de 9 agents : direction, marketing, prospection, vente, client, finance, analyse, organisation, stratégie.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12143a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
