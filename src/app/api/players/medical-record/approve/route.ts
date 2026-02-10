/**
 * POST /api/players/medical-record/approve
 * Marca la ficha médica del jugador como cumplida (approvedAt, approvedBy).
 * Solo administrador o entrenador de la escuela.
 */

import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { verifyIdToken } from "@/lib/auth-server";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { schoolId, playerId } = body as { schoolId?: string; playerId?: string };
    if (!schoolId || !playerId) {
      return NextResponse.json(
        { error: "Faltan schoolId o playerId" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const uid = auth.uid;

    const schoolUserSnap = await db.doc(`schools/${schoolId}/users/${uid}`).get();
    const schoolUserData = schoolUserSnap.data() as { role?: string } | undefined;
    const isStaff =
      schoolUserSnap.exists &&
      (schoolUserData?.role === "school_admin" || schoolUserData?.role === "coach");
    const platformSnap = await db.doc(`platformUsers/${uid}`).get();
    const isSuperAdmin =
      platformSnap.exists &&
      (platformSnap.data() as { super_admin?: boolean })?.super_admin === true;

    if (!isStaff && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Solo el administrador o entrenador de la escuela puede marcar la ficha como cumplida" },
        { status: 403 }
      );
    }

    const playerRef = db.doc(`schools/${schoolId}/players/${playerId}`);
    const playerSnap = await playerRef.get();
    if (!playerSnap.exists) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const data = playerSnap.data() as { medicalRecord?: { url?: string; storagePath?: string; uploadedAt?: unknown; uploadedBy?: string } };
    const current = data?.medicalRecord;
    if (!current?.url) {
      return NextResponse.json(
        { error: "Este jugador aún no tiene una ficha médica cargada" },
        { status: 400 }
      );
    }

    const medicalRecord = {
      ...current,
      approvedAt: Timestamp.now(),
      approvedBy: uid,
    };

    await playerRef.update({ medicalRecord });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[players/medical-record/approve POST]", e);
    return NextResponse.json(
      { error: "Error al marcar ficha cumplida", detail: message },
      { status: 500 }
    );
  }
}
