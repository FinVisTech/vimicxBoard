import { prisma } from "@/lib/prisma";
import type { LogLevel } from "@prisma/client";

async function write(level: LogLevel, category: string, message: string, meta?: Record<string, unknown>) {
  // Always echo to console so Railway logs also have it
  const line = `[${category}] ${message}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);

  try {
    await prisma.logEntry.create({
      data: { level, category, message, meta: meta ? JSON.stringify(meta) : null }
    });
  } catch {
    // Never let logging crash the app
  }
}

export const logger = {
  info:  (category: string, message: string, meta?: Record<string, unknown>) => write("INFO",  category, message, meta),
  warn:  (category: string, message: string, meta?: Record<string, unknown>) => write("WARN",  category, message, meta),
  error: (category: string, message: string, meta?: Record<string, unknown>) => write("ERROR", category, message, meta),
  debug: (category: string, message: string, meta?: Record<string, unknown>) => write("DEBUG", category, message, meta),
};
