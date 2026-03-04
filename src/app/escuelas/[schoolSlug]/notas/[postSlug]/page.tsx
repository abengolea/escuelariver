import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getSchoolBySlug } from "@/lib/posts/server";
import { PostContentRenderer } from "@/components/notas/PostContentRenderer";
import { TagList } from "@/components/notas/TagList";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import type { Metadata } from "next";

function ArticleJsonLd({ post }: { post: { title: string; excerpt: string; coverImageUrl?: string; publishedAt?: Date; createdByName: string } }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl,
    datePublished: post.publishedAt?.toISOString(),
    author: { "@type": "Person", name: post.createdByName },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

type Props = {
  params: Promise<{ schoolSlug: string; postSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug, postSlug } = await params;
  const post = await getPostBySlug(schoolSlug, postSlug);
  if (!post) return { title: "Nota no encontrada" };

  return {
    title: `${post.title} | Escuelas River`,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { schoolSlug, postSlug } = await params;
  const post = await getPostBySlug(schoolSlug, postSlug);
  if (!post) notFound();

  const publishedAt = post.publishedAt instanceof Date ? post.publishedAt : post.publishedAt ? new Date(post.publishedAt) : null;

  return (
    <>
      <ArticleJsonLd
        post={{
          title: post.title,
          excerpt: post.excerpt,
          coverImageUrl: post.coverImageUrl,
          publishedAt: publishedAt ?? undefined,
          createdByName: post.publishedByName || post.createdByName,
        }}
      />
    <article className="container py-8 md:py-12 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href={`/escuelas/${schoolSlug}/notas`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a notas
        </Link>
      </Button>

      <header className="space-y-4">
        <span className="text-sm font-medium text-muted-foreground">
          {post.schoolName}
        </span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-headline">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="text-xl text-muted-foreground">{post.excerpt}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {publishedAt && (
            <time dateTime={publishedAt.toISOString()}>
              {format(publishedAt, "d 'de' MMMM yyyy", { locale: es })}
            </time>
          )}
          <span>Por {post.publishedByName || post.createdByName}</span>
          {post.tags && post.tags.length > 0 && (
            <TagList tags={post.tags} size="sm" />
          )}
        </div>
      </header>

      {post.coverImageUrl && (
        <div className="relative aspect-video w-full mt-8 rounded-lg overflow-hidden bg-muted">
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>
      )}

      <div className="mt-8 prose prose-neutral dark:prose-invert max-w-none">
        <PostContentRenderer content={post.content} />
      </div>

      {post.galleryUrls && post.galleryUrls.length > 0 && (
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {post.galleryUrls.map((url, i) => (
            <div key={i} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <Image
                src={url}
                alt={`Imagen ${i + 1} de la galería`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>
          ))}
        </div>
      )}
    </article>
    </>
  );
}
