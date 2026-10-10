import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ShakeProof: prove you actually met",
  description:
    "Mutual-consent, on-chain proof of real-world meetups on Monad. Two people, one icebreaker, two signatures.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0b1a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
