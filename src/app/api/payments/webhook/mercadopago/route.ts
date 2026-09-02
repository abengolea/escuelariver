/**
 * GET/POST /api/payments/webhook/mercadopago?schoolId=xxx
 * Recibe notificaciones IPN/Webhook de Mercado Pago (topic=payment, id=payment_id).
 * La notification_url incluye schoolId para usar el access_token de esa escuela
 * y consultar el pago en la API de MP.
 *
 * IPN envía topic e id por query. Webhooks pueden enviar type y data.id en el body.
 * Responder 200 rápido y procesar después para no agotar el timeout de MP.
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  findPaymentByProviderId,
  createPayment,
  updatePlayerStatus,
  playerExistsInSchool,
  getMercadoPagoAccessToken,
  refreshMercadoPagoConnection,
} from '@/lib/payments/db';
import { isMercadoPagoUnauthorizedError } from '@/lib/payments/mercadopago-oauth';
import { sendEmailEvent } from '@/lib/payments/email-events';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import type admin from 'firebase-admin';

/** external_reference que guardamos al crear la preferencia: schoolId|playerId|period */
function parseExternalReference(ref: string): { schoolId: string; playerId: string; period: string } | null {
  const parts = ref.split('|');
  if (parts.length !== 3) return null;
  const [schoolId, playerId, period] = parts;
  if (!schoolId || !playerId || !period) return null;
  return { schoolId, playerId, period };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic');
  const id = url.searchParams.get('id');
  const schoolId = url.searchParams.get('schoolId');
  return processNotification({ topic, paymentId: id, schoolId });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get('schoolId');
  let topic: string | null = url.searchParams.get('topic');
  let paymentId: string | null = url.searchParams.get('id');
  try {
    const body = await request.json().catch(() => ({}));
    if (!topic) topic = body.type ?? body.topic ?? null;
    if (!paymentId) paymentId = body.data?.id ?? body.id ?? null;
  } catch {
    // body vacío o no JSON
  }
  return processNotification({ topic, paymentId, schoolId });
}

async function processNotification(params: {
  topic: string | null;
  paymentId: string | null;
  schoolId: string | null;
}) {
  const { topic, paymentId, schoolId } = params;

  // Siempre responder 200 a MP para que no reintente
  if (topic !== 'payment' || !paymentId || !schoolId) {
    return NextResponse.json({ ok: true });
  }

  const db = getAdminFirestore();

  let accessToken = await getMercadoPagoAccessToken(db, schoolId);
  if (!accessToken) {
    console.warn('[webhook/mercadopago] No token for schoolId:', schoolId);
    return NextResponse.json({ ok: true });
  }

  let payment: { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string };
  try {
    payment = await fetchMercadoPagoPayment(accessToken, paymentId);
  } catch (e) {
    if (isMercadoPagoUnauthorizedError(e)) {
      try {
        accessToken = await refreshMercadoPagoConnection(db, schoolId);
        payment = await fetchMercadoPagoPayment(accessToken, paymentId);
      } catch (retryError) {
        console.error('[webhook/mercadopago] GET payment failed after refresh', paymentId, retryError);
        return NextResponse.json({ ok: true });
      }
    } else {
      console.error('[webhook/mercadopago] GET payment failed', paymentId, e);
      return NextResponse.json({ ok: true });
    }
  }

  if (payment.status !== 'approved') {
    return NextResponse.json({ ok: true });
  }

  const ref = parseExternalReference(payment.external_reference ?? '');
  if (!ref) {
    console.warn('[webhook/mercadopago] Invalid external_reference:', payment.external_reference);
    return NextResponse.json({ ok: true });
  }

  const { playerId, period } = ref;
  const amount = payment.transaction_amount ?? 0;
  const currency = payment.currency_id ?? 'ARS';

  const playerExists = await playerExistsInSchool(db, schoolId, playerId);
  if (!playerExists) {
    console.warn('[webhook/mercadopago] Player not in school', { schoolId, playerId });
    return NextResponse.json({ ok: true });
  }

  const now = new Date();
  const idempotencyKey = `mercadopago_${paymentId}`;
  await createPayment(
    db,
    {
      playerId,
      schoolId,
      period,
      amount,
      currency,
      provider: 'mercadopago',
      providerPaymentId: String(paymentId),
      status: 'approved',
      paidAt: now,
    },
    idempotencyKey
  );

  await updatePlayerStatus(db, schoolId, playerId, 'active');

  const playerRef = db.collection('schools').doc(schoolId).collection('players').doc(playerId);
  const playerSnap = await playerRef.get();
  const playerData = playerSnap.data();
  const playerName = playerData
    ? `${playerData.firstName ?? ''} ${playerData.lastName ?? ''}`.trim()
    : 'Jugador';
  const toEmail = playerData?.email;
  if (toEmail) {
    try {
      await sendEmailEvent({
        db: db as admin.firestore.Firestore,
        type: 'payment_receipt',
        playerId,
        schoolId,
        period,
        to: toEmail,
        playerName,
        amount,
        currency,
        paidAt: now,
      });
    } catch (emailErr) {
      console.warn('[webhook/mercadopago] Email no enviado:', emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}

async function fetchMercadoPagoPayment(
  accessToken: string,
  paymentId: string
): Promise<{ status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string }> {
  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });
  const paymentClient = new Payment(client);
  const res = await paymentClient.get({ id: paymentId });
  return {
    status: res.status,
    external_reference: res.external_reference,
    transaction_amount: res.transaction_amount,
    currency_id: res.currency_id,
  };
}
