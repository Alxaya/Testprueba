import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Guias practicas de contenido, SEO y ecommerce para tiendas online espanolas. Sin humo y con ejemplos aplicables hoy.',
  alternates: { canonical: '/blog' },
};

// La lista se lee de base de datos, que no esta disponible en tiempo de build.
// Se renderiza en cada peticion y se cachea 5 minutos en la capa de datos.
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function BlogIndexPage() {
  const posts = await prisma.blogPost
    .findMany({
      where: { published: true },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        tags: true,
        coverEmoji: true,
        readingMinutes: true,
      },
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-extrabold sm:text-5xl">Blog</h1>
        <p className="muted mt-4 text-lg">
          Contenido, SEO y ecommerce aplicado a tiendas espanolas. Publicamos lo que nosotros
          usamos, no teoria.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="surface mt-12 p-10 text-center">
          <p className="muted">Todavia no hay articulos publicados. Vuelve pronto.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <article key={post.slug} className="surface flex flex-col p-6 transition-colors hover:border-brand-400">
              <span className="text-2xl" aria-hidden>
                {post.coverEmoji}
              </span>
              <h2 className="mt-3 text-lg font-semibold leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-brand-600">
                  {post.title}
                </Link>
              </h2>
              <p className="muted mt-2 flex-1 text-sm leading-relaxed">{post.excerpt}</p>
              <div className="muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>}
                <span aria-hidden>·</span>
                <span>{post.readingMinutes} min de lectura</span>
                {post.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="badge">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
