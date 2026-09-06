import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calorie Counter",
  description: "A simple, AI-assisted meal and calorie journal.",
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
