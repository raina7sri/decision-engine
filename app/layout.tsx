import type { Metadata } from "next";
import "./globals.css";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/decision-engine";
export const metadata: Metadata = { title: "GTM Decision Engine | Aurics.AI", description: "Compare high-stakes GTM options against the criteria, priorities, and evidence that matter to your company.", icons: { icon: basePath + "/favicon.svg", shortcut: basePath + "/favicon.svg" } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body className="antialiased">{children}</body></html>; }
