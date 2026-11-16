import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteUrl } from "@/lib/env";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TinyOps — Your business, organized.",
    template: "%s · TinyOps",
  },
  description:
    "TinyOps keeps your SOPs, tasks, recurring checklists and team handovers organized in one simple workspace built for small businesses.",
  applicationName: "TinyOps",
  openGraph: {
    type: "website",
    siteName: "TinyOps",
    title: "TinyOps — Your business, organized.",
    description: "SOPs, tasks, recurring checklists and team handovers in one simple workspace.",
  },
};

export const viewport: Viewport = {
  themeColor: "#168A56",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
