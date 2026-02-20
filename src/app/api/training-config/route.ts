/**
 * GET /api/training-config?schoolId=...
 * Obtiene la configuración de horarios de entrenamiento.
 *
 * PUT /api/training-config
 * Actualiza la configuración (admin o coach).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getTrainingConfig, saveTrainingConfig } from "@/lib/training-config";
import { verifyIdToken } from "@/lib/auth-server";

const TrainingSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().optional().refine((v) => !v || /^\d{1,2}:\d{2}$/.test(v), "Formato HH:mm"),
  categoryFrom: z.string().min(1),
  categoryTo: z.string().min(1),
  tipoCategoria: z.enum(["masculino", "femenino", "arquero"]).optional(),
  maxQuota: z.number().int().min(1).max(500),
  coachId: z.string().min(1),
});

const PutBodySchema = z.object({
  schoolId: z.string().min(1),
  slots: z.array(TrainingSlotSchema),
});

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    if (!schoolId) {
      return NextResponse.json(
        { error: "schoolId requerido" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const config = await getTrainingConfig(db, schoolId);

    return NextResponse.json({
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[training-config GET]", e);
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get("Authorization"));
    if (!auth) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { schoolId, slots } = parsed.data;
    const db = getAdminFirestore();

    await saveTrainingConfig(db, schoolId, slots, auth.uid);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[training-config PUT]", e);
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
