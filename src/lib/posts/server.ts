/**
 * Helpers server-side para posts. Usar solo en API routes o Server Components.
 */

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { CreatePostInput, UpdatePostInput, PostStatus } from "@/lib/types/posts";
import { slugify } from "./slugify";

const POSTS_COLLECTION = "posts";

function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string") return new Date(v);
  return undefined;
}

/** Convierte doc Firestore a Post. */
function docToPost(
  id: string,
  data: Record<string, unknown>
): Omit<import("@/lib/types/posts").Post, "id"> & { id: string } {
  return {
    id,
    schoolId: String(data.schoolId ?? ""),
    schoolSlug: String(data.schoolSlug ?? ""),
    schoolName: String(data.schoolName ?? ""),
    title: String(data.title ?? ""),
    slug: String(data.slug ?? ""),
    excerpt: String(data.excerpt ?? ""),
    content: String(data.content ?? ""),
    coverImageUrl: data.coverImageUrl ? String(data.coverImageUrl) : undefined,
    galleryUrls: Array.isArray(data.galleryUrls) ? data.galleryUrls.map(String) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : undefined,
    searchKeywords: data.searchKeywords ? String(data.searchKeywords) : undefined,
    status: (data.status as PostStatus) ?? "draft",
    createdAt: toDate(data.createdAt) ?? new Date(),
    updatedAt: toDate(data.updatedAt) ?? new Date(),
    createdByUid: String(data.createdByUid ?? ""),
    createdByName: String(data.createdByName ?? ""),
    updatedByUid: String(data.updatedByUid ?? ""),
    updatedByName: String(data.updatedByName ?? ""),
    publishedAt: toDate(data.publishedAt),
    publishedByUid: data.publishedByUid ? String(data.publishedByUid) : undefined,
    publishedByName: data.publishedByName ? String(data.publishedByName) : undefined,
  };
}

export async function checkSlugUnique(
  schoolId: string,
  slug: string,
  excludePostId?: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const q = db
    .collection(POSTS_COLLECTION)
    .where("schoolId", "==", schoolId)
    .where("slug", "==", slug);
  const snap = await q.get();
  if (snap.empty) return true;
  if (excludePostId && snap.docs.length === 1 && snap.docs[0].id === excludePostId) return true;
  return false;
}

export async function createPost(
  input: CreatePostInput,
  uid: string,
  displayName: string
): Promise<string> {
  const db = getAdminFirestore();
  const slug = input.slug.trim() || slugify(input.title);
  const unique = await checkSlugUnique(input.schoolId, slug);
  if (!unique) {
    throw new Error("Ya existe una nota con ese slug en esta escuela.");
  }

  const keywords = [input.title, input.excerpt, ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const now = Timestamp.now();
  const doc: Record<string, unknown> = {
    schoolId: input.schoolId,
    schoolSlug: input.schoolSlug,
    schoolName: input.schoolName,
    title: input.title,
    slug,
    excerpt: input.excerpt,
    content: input.content,
    coverImageUrl: input.coverImageUrl ?? null,
    galleryUrls: input.galleryUrls ?? null,
    tags: input.tags ?? null,
    searchKeywords: keywords,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    createdByUid: uid,
    createdByName: displayName,
    updatedByUid: uid,
    updatedByName: displayName,
    publishedAt: null,
    publishedByUid: null,
    publishedByName: null,
  };

  const ref = await db.collection(POSTS_COLLECTION).add(doc);
  return ref.id;
}

export async function updatePost(
  postId: string,
  input: UpdatePostInput,
  uid: string,
  displayName: string
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(POSTS_COLLECTION).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Nota no encontrada.");
  }

  const data = snap.data() as Record<string, unknown>;
  const schoolId = String(data.schoolId ?? "");

  if (input.slug !== undefined) {
    const slug = input.slug.trim() || slugify(input.title ?? String(data.title ?? ""));
    const unique = await checkSlugUnique(schoolId, slug, postId);
    if (!unique) {
      throw new Error("Ya existe una nota con ese slug en esta escuela.");
    }
  }

  const update: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedByUid: uid,
    updatedByName: displayName,
  };
  if (input.title !== undefined) update.title = input.title;
  if (input.slug !== undefined) update.slug = input.slug.trim() || slugify(input.title ?? String(data.title ?? ""));
  if (input.excerpt !== undefined) update.excerpt = input.excerpt;
  if (input.content !== undefined) update.content = input.content;
  if (input.coverImageUrl !== undefined) update.coverImageUrl = input.coverImageUrl;
  if (input.galleryUrls !== undefined) update.galleryUrls = input.galleryUrls;
  if (input.tags !== undefined) update.tags = input.tags;

  // Rebuild keywords
  const title = String(input.title ?? data.title ?? "");
  const excerpt = String(input.excerpt ?? data.excerpt ?? "");
  const tags = (input.tags ?? data.tags) as string[] | undefined;
  update.searchKeywords = [title, excerpt, ...(tags ?? [])].filter(Boolean).join(" ").toLowerCase();

  await ref.update(update);
}

export async function publishPost(
  postId: string,
  uid: string,
  displayName: string
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(POSTS_COLLECTION).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Nota no encontrada.");
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.status === "published") {
    throw new Error("La nota ya está publicada.");
  }
  if (data.status === "archived") {
    throw new Error("No se puede publicar una nota archivada.");
  }

  const now = Timestamp.now();
  await ref.update({
    status: "published",
    publishedAt: now,
    publishedByUid: uid,
    publishedByName: displayName,
    updatedAt: now,
    updatedByUid: uid,
    updatedByName: displayName,
  });
}

export async function unpublishPost(
  postId: string,
  uid: string,
  displayName: string
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(POSTS_COLLECTION).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Nota no encontrada.");
  }

  const now = Timestamp.now();
  await ref.update({
    status: "draft",
    publishedAt: null,
    publishedByUid: null,
    publishedByName: null,
    updatedAt: now,
    updatedByUid: uid,
    updatedByName: displayName,
  });
}

export async function archivePost(
  postId: string,
  uid: string,
  displayName: string
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(POSTS_COLLECTION).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Nota no encontrada.");
  }

  const now = Timestamp.now();
  await ref.update({
    status: "archived",
    updatedAt: now,
    updatedByUid: uid,
    updatedByName: displayName,
  });
}

export interface ListPostsParams {
  schoolId?: string;
  schoolSlug?: string;
  status?: PostStatus;
  limit: number;
  cursor?: string;
  search?: string;
}

export interface ListPostsResult {
  posts: Array<import("@/lib/types/posts").Post>;
  nextCursor: string | null;
}

export async function listPosts(params: ListPostsParams): Promise<ListPostsResult> {
  const db = getAdminFirestore();
  let q = db.collection(POSTS_COLLECTION) as FirebaseFirestore.Query;

  if (params.schoolId) {
    q = q.where("schoolId", "==", params.schoolId);
  }
  if (params.schoolSlug) {
    q = q.where("schoolSlug", "==", params.schoolSlug);
  }
  if (params.status) {
    q = q.where("status", "==", params.status);
  }

  const orderField = params.status === "published" ? "publishedAt" : "updatedAt";
  q = q.orderBy(orderField, "desc").orderBy("createdAt", "desc");
  q = q.limit(params.limit + 1);

  if (params.cursor) {
    const cursorDoc = await db.collection(POSTS_COLLECTION).doc(params.cursor).get();
    if (cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
  }

  const snap = await q.get();
  const docs = snap.docs;
  let posts = docs.map((d) => docToPost(d.id, d.data() as Record<string, unknown>));

  if (params.search?.trim()) {
    const term = params.search.trim().toLowerCase();
    posts = posts.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        (p.searchKeywords ?? "").toLowerCase().includes(term) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(term))
    );
  }

  const hasMore = docs.length > params.limit;
  const nextCursor = hasMore ? docs[docs.length - 1].id : null;

  return {
    posts: posts.slice(0, params.limit),
    nextCursor,
  };
}

export async function getPostBySlug(
  schoolSlug: string,
  postSlug: string
): Promise<import("@/lib/types/posts").Post | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(POSTS_COLLECTION)
    .where("schoolSlug", "==", schoolSlug)
    .where("slug", "==", postSlug)
    .where("status", "==", "published")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0];
  return docToPost(d.id, d.data() as Record<string, unknown>);
}

export async function getPostById(postId: string): Promise<import("@/lib/types/posts").Post | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(POSTS_COLLECTION).doc(postId).get();
  if (!snap.exists) return null;
  return docToPost(snap.id, snap.data() as Record<string, unknown>);
}

export async function getSchoolBySlug(schoolSlug: string): Promise<{ id: string; name: string; slug: string } | null> {
  const db = getAdminFirestore();
  const bySlug = await db
    .collection("schools")
    .where("slug", "==", schoolSlug)
    .limit(1)
    .get();
  if (!bySlug.empty) {
    const d = bySlug.docs[0];
    const data = d.data() as Record<string, unknown>;
    return { id: d.id, name: String(data.name ?? ""), slug: String(data.slug ?? schoolSlug) };
  }
  const byId = await db.collection("schools").doc(schoolSlug).get();
  if (byId.exists) {
    const data = byId.data() as Record<string, unknown>;
    return { id: byId.id, name: String(data.name ?? ""), slug: String(data.slug ?? schoolSlug) };
  }
  return null;
}

export async function getSchoolById(schoolId: string): Promise<{ id: string; name: string; slug: string } | null> {
  const db = getAdminFirestore();
  const snap = await db.collection("schools").doc(schoolId).get();
  if (!snap.exists) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    name: String(d.name ?? ""),
    slug: String(d.slug ?? snap.id),
  };
}
