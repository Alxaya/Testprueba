import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

/** Solo se indexa la web publica: panel, admin y API quedan fuera. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
