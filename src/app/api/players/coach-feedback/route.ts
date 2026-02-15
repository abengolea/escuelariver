/**
 * POST /api/players/coach-feedback
 * Actualiza solo la devolución del entrenador (coachFeedback) del jugador.
 * Solo administrador o entrenador de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { schoolId, playerId, coachFeedback } = body as {
      schoolId?: string;
      playerId?: string;
      coachFeedback?: string;
    };
    if (!schoolId || !playerId) {
      return NextResponse.json(
        { error: "Faltan schoolId o playerId" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;

    const schoolUserSnap = await db
      .doc(`schools/${schoolId}/users/${uid}`)
      .get();
    const userInSchool =
      schoolUserSnap.exists &&
      ["school_admin", "coach"].includes(
        (schoolUserSnap.data() as { role?: string })?.role ?? ""
      );
    const platformUserSnap = await db.doc(`platformUsers/${uid}`).get();
    const isSuperAdmin =
      platformUserSnap.exists &&
      (platformUserSnap.data() as { super_admin?: boolean })?.super_admin === true;

    if (!userInSchool && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Solo el administrador o entrenador puede editar la devolución" },
        { status: 403 }
      );
    }

    const playerRef = db.doc(`schools/${schoolId}/players/${playerId}`);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      return NextResponse.json(
        { error: "Jugador no encontrado en esta escuela" },
        { status: 404 }
      );
    }

    const value = typeof coachFeedback === "string" ? coachFeedback.trim() || null : null;
    await playerRef.update({ coachFeedback: value });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/coach-feedback POST]", e);
    return NextResponse.json(
      { error: "Error al actualizar la devolución", detail: message },
      { status: 500 }
    );
  }
}
