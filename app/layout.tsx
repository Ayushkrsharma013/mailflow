import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MailFlow — AI Inbox Organizer",
  description: "Multi-account Gmail AI assistant — categorize, prioritize, and auto-reply.",
  icons: {
    icon: "/mailflow/logo/mailflow-favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
