import { listPosts } from "@/lib/posts/server";
import { NotasFeed } from "@/components/notas/NotasFeed";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notas | Escuelas River",
  description: "Noticias, actividades y comunicados de Escuelas River",
};

const PAGE_SIZE = 12;

export default async function NotasPage() {
  const { posts, nextCursor } = await listPosts({
    status: "published",
    limit: PAGE_SIZE,
  });

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Notas</h1>
        <p className="text-muted-foreground mt-1">
          Novedades, actividades y comunicados de todas las escuelas.
        </p>
      </div>
      <NotasFeed
        initialPosts={posts}
        initialCursor={nextCursor}
        schoolSlug={undefined}
      />
    </div>
  );
}
