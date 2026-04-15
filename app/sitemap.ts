import { MetadataRoute } from 'next';

/**
 * 🗺️ THE GRID MAP
 * Informs search engines about the primary entry points.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.bar-code.ai';
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}