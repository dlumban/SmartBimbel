import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../src/hooks/useAuth";

export const metadata: Metadata = {
  title: "SmartBimbel Admin",
  description: "Internal admin panel for SmartBimbel operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-neutral-50 text-neutral-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
