/**
 * POST /api/players/medical-record
 * Guarda en el jugador la ficha médica recién subida (url, storagePath, uploadedAt, uploadedBy).
 * Autorizado: el propio jugador (email coincide) o staff de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";

type Payload = {
  schoolId: string;
  playerId: string;
  url: string;
  storagePath: string;
  uploadedAt: string | { seconds: number; nanoseconds: number };
  uploadedBy: string;
};

function toTimestamp(v: string | { seconds: number; nanoseconds: number }): Timestamp {
  if (typeof v === "string") {
    return Timestamp.fromDate(new Date(v));
  }
  if (v && typeof v === "object" && "seconds" in v) {
    return new Timestamp(v.seconds, v.nanoseconds);
  }
  return Timestamp.now();
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = (await request.json()) as Payload;
    const { schoolId, playerId, url, storagePath, uploadedAt, uploadedBy } = body;
    if (!schoolId || !playerId || !url || !storagePath || !uploadedBy) {
      return NextResponse.json(
        { error: "Faltan schoolId, playerId, url, storagePath o uploadedBy" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;
    const userEmail = auth.email?.trim().toLowerCase();

    const playerSnap = await db.doc(`schools/${schoolId}/players/${playerId}`).get();
    if (!playerSnap.exists) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }
    const playerData = playerSnap.data() as { email?: string };
    const playerEmail = (playerData?.email ?? "").trim().toLowerCase();

    const isPlayerSelf = !!userEmail && playerEmail === userEmail;
    const schoolUserSnap = await db.doc(`schools/${schoolId}/users/${uid}`).get();
    const schoolUserData = schoolUserSnap.data() as { role?: string } | undefined;
    const isStaff =
      schoolUserSnap.exists &&
      (schoolUserData?.role === "school_admin" || schoolUserData?.role === "coach");

    if (!isPlayerSelf && !isStaff) {
      return NextResponse.json(
        { error: "No tenés permiso para cargar la ficha médica de este jugador" },
        { status: 403 }
      );
    }

    const medicalRecord = {
      url,
      storagePath,
      uploadedAt: toTimestamp(uploadedAt ?? new Date().toISOString()),
      uploadedBy,
      // No tocamos approvedAt/approvedBy; si había aprobación anterior y se reemplaza el PDF, queda pendiente de nuevo
    };

    await db.doc(`schools/${schoolId}/players/${playerId}`).update({
      medicalRecord,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/medical-record POST]", e);
    return NextResponse.json(
      { error: "Error al guardar la ficha médica", detail: message },
      { status: 500 }
    );
  }
}
