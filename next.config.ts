/** @type {import('next').NextConfig} */

// Define the Content Security Policy to allow Stripe's requirements
const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://maps.googleapis.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.stripe.com https://images.unsplash.com;
    font-src 'self' https://fonts.gstatic.com;
    frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
    connect-src 'self' https://*.stripe.com https://*.supabase.co https://api.runpod.ai;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`;

const nextConfig = {
  // Turbopack is supported in your version (16.1.6)
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

module.exports = nextConfig;