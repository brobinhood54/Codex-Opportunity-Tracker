import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Opportunity Tracker",
  description: "Track stage, progress, risk, and next steps for open opportunities.",
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
