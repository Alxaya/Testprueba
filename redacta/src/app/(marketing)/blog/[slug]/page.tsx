import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { markdownToHtml } from '@/lib/markdown';
import { formatDate } from '@/lib/utils';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

async function getPost(slug: string) {
  return prisma.blogPost.findFirst({ where: { slug, published: true } }).catch(() => null);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Articulo no encontrado' };

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      publishedTime: post.publishedAt?.toISOString(),
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // El contador es orientativo: no bloquea el renderizado si falla.
  void prisma.blogPost.update({ where: { id: post.id }, data: { views: { increment: 1 } } }).catch(() => {});

  const html = markdownToHtml(post.contentMd);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { '@type': 'Organization', name: site.name },
    publisher: { '@type': 'Organization', name: site.name },
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
    inLanguage: 'es-ES',
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <Link href="/blog" className="muted text-sm hover:text-brand-600">
        ← Volver al blog
      </Link>

      <header className="mt-6">
        <span className="text-3xl" aria-hidden>
          {post.coverEmoji}
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{post.title}</h1>
        <div className="muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>}
          <span aria-hidden>·</span>
          <span>{post.readingMinutes} min de lectura</span>
          {post.generatedByAi && (
            <span className="badge" title="Borrador generado por nuestro propio motor y revisado antes de publicar">
              Asistido por IA
            </span>
          )}
        </div>
      </header>

      <div
        className="prose-content mt-10"
        // El HTML procede de markdownToHtml, que escapa toda la entrada antes
        // de generar etiquetas: no puede inyectarse HTML desde el contenido.
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <aside className="surface mt-14 p-6 text-center">
        <h2 className="font-semibold">¿Te ahorrarias tiempo escribiendo esto?</h2>
        <p className="muted mt-2 text-sm">
          Redacta genera fichas, articulos y guiones con el tono de tu marca. Cinco gratis al mes.
        </p>
        <Link href="/registro" className="btn btn-primary mt-4">
          Probar gratis
        </Link>
      </aside>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
    </article>
  );
}
