/** @type {import('next').NextConfig} */

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com blob:;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.stripe.com https://images.unsplash.com https://www.transparenttextures.com;
    font-src 'self' https://fonts.gstatic.com;
    frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
    connect-src 'self' blob: wss://*.supabase.co https://*.stripe.com https://*.supabase.co https://api.runpod.ai;
    media-src 'self' blob: data: https://*.supabase.co;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`;

const nextConfig = {
  transpilePackages: ["lucide-react"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\s{2,}/g, ' ').trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;