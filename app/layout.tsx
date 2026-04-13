import type { Metadata } from "next";
import Script from "next/script"; // 🚨 SURGICAL FIX: Added Next.js Script import
import "./globals.css";

export const metadata: Metadata = {
  title: "BAR-CODE.AI | AI Driven DAW & Label",
  description: "Algorithmic Fintech Engine & Creation Studio by GetNice Records.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Oswald:wght@400;700&family=Roboto+Mono&display=swap" rel="stylesheet" />
        
        {/* 🚨 SURGICAL FIX: The Global Watcher lives unconditionally at the root of the app */}
        <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=AW-18074669646`} /> {/* ⚠️ REPLACE AW- ID HERE */}
        <Script id="google-ads-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18074669646'); // ⚠️ REPLACE AW- ID HERE
          `}} 
        />
      </head>
      <body className="antialiased font-sans bg-[#121212] text-[#E0E0E0]">
        {children}
      </body>
    </html>
  );
}