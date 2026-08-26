import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../src/hooks/useAuth";
import { SiteSidebar } from "../src/components/SiteSidebar";

export const metadata: Metadata = {
  title: "SmartBimbel — Temukan tutor privat terbaik",
  description: "Temukan tutor privat terbaik, jadwalkan les dengan mudah.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="font-sans bg-background text-foreground">
        <AuthProvider>
          {/* Stacked (top bar + content) on mobile, side-by-side (sidebar +
              content) from md up - SiteSidebar itself switches between a
              header+horizontal-nav and a static column at that same
              breakpoint. */}
          <div className="flex min-h-screen flex-col md:flex-row">
            <SiteSidebar />
            {/* min-w-0 keeps wide content (calendar grid, tables) from
                stretching this column and pushing the sidebar off-screen. */}
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
