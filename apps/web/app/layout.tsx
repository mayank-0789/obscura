import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/lib/auth-config";
import { Providers } from "@/lib/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Obscura — Confidential pay-per-call for AI agents",
  description:
    "x402 with the public spend graph removed. Agents pay merchants per API call from encrypted balances; the on-chain link between sender and receiver is broken via the Umbra mixer commitment tree.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
