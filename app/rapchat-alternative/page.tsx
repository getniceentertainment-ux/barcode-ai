import type { Metadata } from 'next';
import Link from 'next/link';

// ADVANCED SEO METADATA (Open Graph, Twitter, Canonical)
export const metadata: Metadata = {
  title: 'The #1 Rapchat Alternative for 2026 | Zero Latency AI Studio',
  description: 'Tired of Rapchat lag and Bluetooth delay? Upgrade to Bar-Code.ai. The first browser DAW with zero-latency vocal tracking, AI ghostwriting, and built-in label advances.',
  keywords: ['Rapchat alternative', 'Bandlab alternative', 'browser DAW', 'zero latency vocal recording', 'AI ghostwriter', 'music production app', 'GetNice Records'],
  alternates: {
    canonical: 'https://bar-code.ai/rapchat-alternative',
  },
  openGraph: {
    title: 'Stop Fighting Rapchat Lag. Enter the Matrix.',
    description: 'The ultimate Rapchat alternative is here. Zero-latency vocal tracking, AI ghostwriting, and $1,500 advances.',
    url: 'https://bar-code.ai/rapchat-alternative',
    siteName: 'Bar-Code.ai',
    images: [
      {
        url: 'https://bar-code.ai/og-rapchat-alternative.jpg', // Ensure you drop a cool image in your /public folder later
        width: 1200,
        height: 630,
        alt: 'Bar-Code.ai vs Rapchat Comparison',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The #1 Rapchat Alternative for 2026',
    description: 'Bypass Bluetooth delay completely. Track perfectly to the grid in your browser.',
    images: ['https://bar-code.ai/og-rapchat-alternative.jpg'],
  },
};

export default function RapchatAlternativePage() {
  // JSON-LD SCHEMA MARKUP FOR GOOGLE'S KNOWLEDGE GRAPH
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Bar-Code.ai Matrix',
    operatingSystem: 'Any (Browser-based)',
    applicationCategory: 'MultimediaApplication',
    description: 'An AI-powered browser DAW providing zero-latency vocal tracking, AI ghostwriting, and automated record label advances. The premier alternative to mobile recording apps like Rapchat.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Alpha Node Access',
    },
    creator: {
      '@type': 'Organization',
      name: 'GetNice Records',
    },
  };

  return (
    <>
      {/* INJECT STRUCTURED DATA INTO THE DOM */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-green-500 selection:text-black">
        
        {/* SECTION 1: HERO */}
        <section className="relative px-6 py-24 mx-auto max-w-7xl lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl uppercase">
              Stop Fighting <span className="text-red-500 line-through">Rapchat Lag</span>.<br />
              <span className="text-green-400">Enter the Matrix.</span>
            </h1>
            <p className="max-w-2xl mx-auto mt-6 text-lg leading-8 text-gray-300">
              The ultimate alternative is here. No more Bluetooth delay. No more beat block. Bar-Code.ai is the first AI-powered browser studio that tracks perfectly to the grid and acts as your record label.
            </p>
            <div className="flex items-center justify-center mt-10 gap-x-6">
              <Link 
                href="/" 
                className="px-8 py-4 text-sm font-bold text-black uppercase transition-all bg-green-500 rounded-sm hover:bg-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
              >
                Initialize Node (Bypass Waitlist)
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500 uppercase tracking-widest">
              Currently accepting 50 Alpha Testers. Keep 100% of your masters.
            </p>
          </div>
        </section>

        {/* SECTION 2: COMPARISON MATRIX */}
        <section className="px-6 py-16 mx-auto max-w-5xl border-y border-gray-800">
          <div className="overflow-hidden bg-zinc-900 border border-gray-800 rounded-lg shadow-2xl">
            <table className="min-w-full text-left divide-y divide-gray-800">
              <thead className="bg-black">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-white uppercase">Feature</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-500 uppercase">Rapchat / Mobile App</th>
                  <th className="px-6 py-4 text-sm font-semibold text-green-400 uppercase border-l border-gray-800 bg-zinc-950">Bar-Code.ai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300">Vocal Tracking</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Bluetooth Delay & Manual Dragging</td>
                  <td className="px-6 py-4 text-sm font-bold text-white border-l border-gray-800 bg-zinc-950">Zero Latency (Web Audio API)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300">Beat Block Fix</td>
                  <td className="px-6 py-4 text-sm text-gray-500">None. You're on your own.</td>
                  <td className="px-6 py-4 text-sm font-bold text-white border-l border-gray-800 bg-zinc-950">AI Ghostwriter & Cadence Injection</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300">Monetization</td>
                  <td className="px-6 py-4 text-sm text-gray-500">You pay them for "Pro"</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-400 border-l border-gray-800 bg-zinc-950">We pay you ($1,500 Advances)</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300">Feature Verses</td>
                  <td className="px-6 py-4 text-sm text-gray-500">Risky IG DMs</td>
                  <td className="px-6 py-4 text-sm font-bold text-white border-l border-gray-800 bg-zinc-950">Programmatic Fiat Escrow</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: THE PAYLOAD */}
        <section className="px-6 py-24 mx-auto max-w-7xl lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="p-6 border border-gray-800 bg-zinc-950 rounded-xl hover:border-gray-600 transition-colors">
              <h3 className="text-xl font-bold text-white uppercase">1. Zero Latency (The Booth)</h3>
              <p className="mt-4 text-gray-400">
                Latency is a hardware problem. We fixed it with software. The GetNice Engine taps directly into your browser's Web Audio API. Our visual metronome bypasses Bluetooth delay completely.
              </p>
            </div>
            <div className="p-6 border border-green-900 bg-zinc-950 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <h3 className="text-xl font-bold text-green-400 uppercase">2. AI Ghostwriter (Room 03)</h3>
              <p className="mt-4 text-gray-400">
                Writer's block is dead. Inject any beat, and the matrix extracts the exact DSP. Room 03 generates mathematically locked lyrics perfectly tailored to the cadence of the instrumental.
              </p>
            </div>
            <div className="p-6 border border-gray-800 bg-zinc-950 rounded-xl hover:border-gray-600 transition-colors">
              <h3 className="text-xl font-bold text-white uppercase">3. Auto Advance (Room 08)</h3>
              <p className="mt-4 text-gray-400">
                Stop begging for deals. When your track hits the required AI metric score, the R08 Bank automatically triggers a $1,500 fiat advance to run targeted marketing campaigns. No 360 deals.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: SOCIAL SYNDICATE */}
        <section className="px-6 py-24 mx-auto text-center max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight text-white uppercase sm:text-4xl">Stop Getting Scammed For Features</h2>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            The era of stolen feature money in Instagram DMs is over. The Bar-Code Social Syndicate is a built-in stock market for Hip-Hop. Book a feature, and the funds are locked in a programmatic fiat escrow. The money literally cannot move until their vocal stems are tracked and verified on-beat by the Matrix.
          </p>
        </section>

        {/* SECTION 5: FOOTER CONVERSION */}
        <footer className="px-6 py-16 border-t border-gray-800 bg-zinc-950">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white uppercase">The Industry is Shifting.</h2>
            <p className="mt-2 text-gray-400">Don't get left on the old tech. Dropping 50 Alpha Nodes today.</p>
            
            <div className="mt-8 flex justify-center">
              <Link 
                href="/" 
                className="px-10 py-4 text-sm font-bold text-black uppercase transition-all bg-green-500 rounded-sm hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              >
                Claim Node
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}