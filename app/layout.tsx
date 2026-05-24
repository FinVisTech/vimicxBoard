import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vimicx Board",
  description: "A fast team memory layer for Vimicx tasks."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link href="/board" className="text-xl font-semibold tracking-normal">
              Vimicx Board
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/board">Board</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/settings" prefetch={false}>Settings</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

