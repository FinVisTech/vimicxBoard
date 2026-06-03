import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vimicx Board",
  description: "A fast team memory layer for Vimicx tasks.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pendingCount = await prisma.pendingTask.count({ where: { status: "PENDING" } }).catch(() => 0);

  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link href="/board" className="text-2xl font-bold tracking-normal text-primary">
              Vimicx Board
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <Link href="/board">Board</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/review" className="relative">
                Review
                {pendingCount > 0 && (
                  <span className="absolute -right-4 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/compose">Compose</Link>
              <Link href="/logs">Logs</Link>
              <Link href="/settings" prefetch={false}>Settings</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
