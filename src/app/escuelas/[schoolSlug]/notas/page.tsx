import { notFound } from "next/navigation";
import { listPosts, getSchoolBySlug } from "@/lib/posts/server";
import { NotasFeed } from "@/components/notas/NotasFeed";
import type { Metadata } from "next";

const PAGE_SIZE = 12;

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) return { title: "Escuela no encontrada" };
  return {
    title: `Notas - ${school.name} | Escuelas River`,
    description: `Noticias, actividades y comunicados de ${school.name}`,
  };
}

export default async function SchoolNotasPage({ params }: Props) {
  const { schoolSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const { posts, nextCursor } = await listPosts({
    schoolSlug,
    status: "published",
    limit: PAGE_SIZE,
  });

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Notas - {school.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Novedades, actividades y comunicados de esta escuela.
        </p>
      </div>
      <NotasFeed
        initialPosts={posts}
        initialCursor={nextCursor}
        schoolSlug={schoolSlug}
      />
    </div>
  );
}
