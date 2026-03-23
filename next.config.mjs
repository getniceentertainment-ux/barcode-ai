/** @type {import('next').NextConfig} */

// SURGICAL FIX: Cleaned and unified the CSP string
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.stripe.com https://images.unsplash.com https://www.transparenttextures.com https://*.supabase.co;
    font-src 'self' https://fonts.gstatic.com;
    frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
    connect-src 'self' blob: wss://*.supabase.co https://*.stripe.com https://*.supabase.co https://api.runpod.ai;
    media-src 'self' blob: data: https://*.supabase.co https://www.soundhelix.com;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim(); // Removes line breaks and extra spaces for header validity

const nextConfig = {
  transpilePackages: ["lucide-react"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // SURGICAL FIX: Reference the variable above instead of a hardcoded string
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;