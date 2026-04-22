import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

// 🛡️ REFINED SEO PERIMETER
// This expanded description helps Google's algorithm better categorize your 
// platform for the Performance Max campaign.
export const metadata: Metadata = {
  title: "BAR-CODE.AI | Algorithmic DAW & Record Label",
  description: "BAR-CODE.AI is an algorithmic fintech engine and digital creation studio by GetNice Records. Built for independent hip-hop nodes, we provide AI ghostwriting, forensic audio extraction, and automated $1,500 marketing advances.",
  keywords: ["AI DAW", "Hip Hop AI", "GetNice Records", "Algorithmic Label", "Music Fintech", "AI Ghostwriter"],
  openGraph: {
    title: "BAR-CODE.AI | The Matrix is Open",
    description: "The first identity-aware AI studio built for the streets. Join the Syndicate.",
    type: "website",
    url: "https://bar-code.ai",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 🚨 TACTICAL CONFIG: The Global Watcher ID
  const GOOGLE_ADS_ID = "AW-18074669646";

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Oswald:wght@400;700&family=Roboto+Mono&display=swap" rel="stylesheet" />
        
        {/* GLOBAL WATCHER: Tracks user movement for Google Ads Performance Max */}
        <Script 
          strategy="afterInteractive" 
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} 
        />
        <Script id="google-ads-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}} 
        />
      </head>
      <body className="antialiased font-sans bg-[#121212] text-[#E0E0E0] overflow-x-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}