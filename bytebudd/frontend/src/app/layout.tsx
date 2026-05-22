import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ByteBudd - AI SQL Assistant",
  description: "Self-hosted AI SQL assistant. Ask questions, get answers from your database.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
