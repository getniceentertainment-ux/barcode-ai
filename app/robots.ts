import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin-node',
        '/dev-portal',
        '/*{',    // 🛡️ Kill JSON-like paths (leaks)
        '/*}',    // 🛡️ Kill JSON-like paths (leaks)
        '/*"',    // 🛡️ Kill quote-leaks
        '/*%22',  // 🛡️ Kill encoded quote-leaks
      ],
    },
    sitemap: 'https://www.bar-code.ai/sitemap.xml',
  };
}