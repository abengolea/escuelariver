/**
 * POST /api/players/update
 * Actualiza el documento de un jugador usando Admin SDK (evita reglas del cliente).
 * Autorizado si: el usuario es el jugador (su email coincide con updateData.email) o es staff de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";

type UpdatePayload = {
  schoolId: string;
  playerId: string;
  updateData: {
    firstName: string;
    lastName: string;
    birthDate: { seconds: number; nanoseconds: number } | ReturnType<Timestamp["toDate"]>;
    dni: string | null;
    healthInsurance: string | null;
    email: string | null;
    tutorContact: { name: string; phone: string };
    status: string;
    photoUrl: string | null;
    observations: string | null;
    altura_cm: number | null;
    peso_kg: number | null;
    pie_dominante: string | null;
    posicion_preferida: string | null;
  };
  oldEmail?: string | null;
};

function toFirestoreTimestamp(
  v: { seconds: number; nanoseconds: number } | Date | unknown
): Timestamp {
  if (v && typeof v === "object" && "seconds" in v && "nanoseconds" in v) {
    return new Timestamp((v as { seconds: number; nanoseconds: number }).seconds, (v as { seconds: number; nanoseconds: number }).nanoseconds);
  }
  if (v instanceof Date) {
    return Timestamp.fromDate(v);
  }
  return Timestamp.now();
}

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { uid, email: userEmail } = auth;
    if (!userEmail) {
      return NextResponse.json({ error: "Usuario sin email" }, { status: 403 });
    }

    const body = (await request.json()) as UpdatePayload;
    const { schoolId, playerId, updateData: raw, oldEmail } = body;
    if (!schoolId || !playerId || !raw) {
      return NextResponse.json({ error: "Faltan schoolId, playerId o updateData" }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Autorización: jugador (email en updateData coincide) o staff (está en schools/schoolId/users)
    const isPlayerSelf =
      raw.email != null &&
      raw.email.trim().toLowerCase() === userEmail.trim().toLowerCase();
    const userInSchool = await db
      .doc(`schools/${schoolId}/users/${uid}`)
      .get()
      .then((s) => s.exists);

    if (!isPlayerSelf && !userInSchool) {
      return NextResponse.json(
        { error: "No tenés permiso para actualizar este jugador" },
        { status: 403 }
      );
    }

    const birthDate = raw.birthDate
      ? toFirestoreTimestamp(raw.birthDate)
      : Timestamp.now();

    const updateData = {
      ...raw,
      birthDate,
    };

    const playerRef = db.doc(`schools/${schoolId}/players/${playerId}`);
    await playerRef.update(updateData);

    const newEmailNorm = raw.email?.trim().toLowerCase() || null;
    const oldEmailNorm = oldEmail?.trim().toLowerCase() || null;

    if (newEmailNorm) {
      await db.doc(`playerLogins/${newEmailNorm}`).set({ schoolId, playerId });
    }
    if (oldEmailNorm && oldEmailNorm !== newEmailNorm) {
      await db.doc(`playerLogins/${oldEmailNorm}`).delete();
    } else if (!newEmailNorm && oldEmailNorm) {
      await db.doc(`playerLogins/${oldEmailNorm}`).delete();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/update POST]", e);
    return NextResponse.json(
      { error: "Error al actualizar el jugador", detail: message },
      { status: 500 }
    );
  }
}
