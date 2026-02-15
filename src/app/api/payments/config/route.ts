/**
 * GET /api/payments/config?schoolId=...
 * Obtiene configuración de cuotas de la escuela.
 *
 * PUT /api/payments/config
 * Actualiza configuración (admin).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getOrCreatePaymentConfig } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function GET(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requerido' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const config = await getOrCreatePaymentConfig(db, schoolId);

    return NextResponse.json({
      ...config,
      updatedAt: config.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error('[payments/config GET]', e);
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    );
  }
}

const PutBodySchema = z.object({
  schoolId: z.string().min(1),
  /** Cuota mensual. 0 = solo cobro de inscripción (registrationAmount). */
  amount: z.number().min(0),
  currency: z.string().min(1).default('ARS'),
  dueDayOfMonth: z.number().int().min(1).max(31),
  moraFromActivationMonth: z.boolean().optional(),
  prorateDayOfMonth: z.number().int().min(0).max(31).optional(),
  proratePercent: z.number().int().min(0).max(100).optional(),
  delinquencyDaysEmail: z.number().int().min(1).max(90).optional(),
  delinquencyDaysSuspension: z.number().int().min(1).max(365).optional(),
  registrationAmount: z.number().min(0).optional(),
  /** Montos de cuota mensual por categoría (SUB-5, SUB-6, ... SUB-18). */
  amountByCategory: z.record(z.string(), z.number().min(0)).optional(),
  /** Montos de inscripción por categoría. */
  registrationAmountByCategory: z.record(z.string(), z.number().min(0)).optional(),
  registrationCancelsMonthFee: z.boolean().optional(),
  /** Monto total del pago de ropa (0 = sin cobro). Se divide en clothingInstallments cuotas. */
  clothingAmount: z.number().min(0).optional(),
  /** Número de cuotas para el pago de ropa. Default 2. */
  clothingInstallments: z.number().int().min(1).max(24).optional(),
});

export async function PUT(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PutBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      schoolId,
      amount,
      currency,
      dueDayOfMonth,
      moraFromActivationMonth,
      prorateDayOfMonth,
      proratePercent,
      delinquencyDaysEmail,
      delinquencyDaysSuspension,
      registrationAmount,
      amountByCategory,
      registrationAmountByCategory,
      registrationCancelsMonthFee,
      clothingAmount,
      clothingInstallments,
    } = parsed.data;
    const db = getAdminFirestore();
    const admin = await import('firebase-admin');

    const update: Record<string, unknown> = {
      amount,
      currency,
      dueDayOfMonth,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: auth.uid,
    };
    if (moraFromActivationMonth !== undefined) update.moraFromActivationMonth = moraFromActivationMonth;
    if (prorateDayOfMonth !== undefined) update.prorateDayOfMonth = prorateDayOfMonth;
    if (proratePercent !== undefined) update.proratePercent = proratePercent;
    if (delinquencyDaysEmail !== undefined) update.delinquencyDaysEmail = delinquencyDaysEmail;
    if (delinquencyDaysSuspension !== undefined) update.delinquencyDaysSuspension = delinquencyDaysSuspension;
    if (registrationAmount !== undefined) update.registrationAmount = registrationAmount;
    if (amountByCategory !== undefined) update.amountByCategory = amountByCategory;
    if (registrationAmountByCategory !== undefined) update.registrationAmountByCategory = registrationAmountByCategory;
    if (registrationCancelsMonthFee !== undefined) update.registrationCancelsMonthFee = registrationCancelsMonthFee;
    if (clothingAmount !== undefined) update.clothingAmount = clothingAmount;
    if (clothingInstallments !== undefined) update.clothingInstallments = clothingInstallments;

    await db
      .collection('schools')
      .doc(schoolId)
      .collection('paymentConfig')
      .doc('default')
      .set(update, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[payments/config PUT]', e);
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 }
    );
  }
}
