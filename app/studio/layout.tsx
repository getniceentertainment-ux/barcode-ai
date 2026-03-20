import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BAR-CODE.AI | The Clean Stack",
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
      </head>
      <body className="antialiased font-sans bg-[#121212] text-[#E0E0E0]">
        {children}
      </body>
    </html>
  );
}