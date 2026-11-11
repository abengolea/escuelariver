/**
 * POST /api/payments/update
 * Edita el período de un pago (inscripción ↔ cuota mensual). Solo admin de escuela.
 */

import { NextResponse } from 'next/server';
import { updatePaymentPeriodSchema } from '@/lib/payments/schemas';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getPaymentById, updatePaymentPeriod } from '@/lib/payments/db';
import { verifyIdToken } from '@/lib/auth-server';

export async function POST(request: Request) {
  try {
    const auth = await verifyIdToken(request.headers.get('Authorization'));
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updatePaymentPeriodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { paymentId, schoolId, newPeriod, allowSwap } = parsed.data;
    const db = getAdminFirestore();

    // Solo admin de escuela o super admin puede editar pagos (NO coaches)
    const schoolUserSnap = await db.doc(`schools/${schoolId}/users/${auth.uid}`).get();
    const platformUserSnap = await db.doc(`platformUsers/${auth.uid}`).get();
    const isSchoolAdmin =
      schoolUserSnap.exists &&
      (schoolUserSnap.data() as { role?: string })?.role === 'school_admin';
    const isSuperAdmin =
      platformUserSnap.exists &&
      (platformUserSnap.data() as { super_admin?: boolean })?.super_admin === true;

    if (!isSchoolAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador de la escuela puede editar pagos' },
        { status: 403 }
      );
    }

    const payment = await getPaymentById(db, paymentId);
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }
    if (payment.schoolId !== schoolId) {
      return NextResponse.json({ error: 'El pago no pertenece a esta escuela' }, { status: 400 });
    }

    const result = await updatePaymentPeriod(db, paymentId, schoolId, newPeriod, { allowSwap });
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        const existing = result.duplicate;
        return NextResponse.json(
          {
            error: 'Ya hay un pago cargado para ese jugador y período.',
            code: 'PERIOD_TAKEN',
            existingPayment: existing
              ? {
                  id: existing.id,
                  period: existing.period,
                  amount: existing.amount,
                  currency: existing.currency,
                  paidAt: existing.paidAt ? existing.paidAt.toISOString() : null,
                }
              : null,
          },
          { status: 409 }
        );
      }
      const message =
        result.reason === 'not_approved'
          ? 'Solo se pueden editar pagos aprobados.'
          : 'Pago no encontrado';
      return NextResponse.json({ error: message }, { status: result.reason === 'not_found' ? 404 : 400 });
    }

    return NextResponse.json({
      ok: true,
      swapped: result.swapped,
      payment: {
        id: result.payment.id,
        period: result.payment.period,
        paymentType: result.payment.paymentType,
      },
    });
  } catch (e) {
    console.error('[payments/update]', e);
    return NextResponse.json(
      { error: 'Error al actualizar el pago' },
      { status: 500 }
    );
  }
}
