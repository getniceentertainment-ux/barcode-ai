import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// We initialize a private admin client to fetch the public registry
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🗺️ THE GRID MAP (PROACTIVE DISCOVERY SHIELD)
 * This prevents crawlers from hitting junk URLs by providing a 
 * definitive list of all valid artist nodes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.bar-code.ai';
  
  // Base static routes
  const staticRoutes: MetadataRoute.Sitemap = [
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

  try {
    // 🚨 SURGICAL FIX: Fetch all legitimate stage names to guide Google away from JSON leaks
    const { data: profiles } = await supabase
      .from('profiles')
      .select('stage_name, updated_at')
      .not('stage_name', 'is', null);

    const profileRoutes = (profiles || []).map((profile) => ({
      url: `${baseUrl}/${encodeURIComponent(profile.stage_name)}`,
      lastModified: new Date(profile.updated_at || new Date().toISOString()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...profileRoutes];
  } catch (error) {
    console.warn("Sitemap sync failed. Falling back to static map.");
    return staticRoutes;
  }
}