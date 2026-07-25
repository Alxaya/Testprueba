import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { LEGAL_DOCS } from '@/content/legal';
import { site } from '@/lib/site';

/**
 * Sitemap dinamico: paginas fijas + articulos publicados.
 * Si la base de datos no responde se sirven al menos las paginas fijas: un
 * sitemap incompleto es mucho mejor que un 500 para el rastreador.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/precios`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.url}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${site.url}/registro`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${site.url}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...LEGAL_DOCS.map((doc) => ({
      url: `${site.url}/legal/${doc.slug}`,
      lastModified: new Date(doc.updatedAt),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
  ];

  const posts = await prisma.blogPost
    .findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
    })
    .catch(() => []);

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
