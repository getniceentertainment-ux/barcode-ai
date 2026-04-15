import { MetadataRoute } from 'next';

/**
 * 🛡️ THE PERIMETER GUARD
 * This file prevents the catch-all routes from triggering on system requests.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',       // Protect internal DSP logic
        '/admin-node', // Command Center
        '/dev-portal', // API Portal
      ],
    },
    sitemap: 'https://www.bar-code.ai/sitemap.xml',
  };
}