import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Block Blast Core",
  description: "Block Blast Core game and level editor.",
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
