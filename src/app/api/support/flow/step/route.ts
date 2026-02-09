/**
 * POST /api/support/flow/step
 * Devuelve el siguiente paso del flujo según state y userInput.
 * El cliente puede enviar el flow (ya leído de Firestore) o ejecutar el motor en cliente.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getNextStep } from '@/lib/support/flow-engine';
import type { SupportFlow } from '@/lib/types';

const ChoiceSchema = z.object({
  label: z.string(),
  value: z.string(),
  nextStepId: z.string(),
});

const FormFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'player_select']),
  required: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  placeholder: z.string().optional(),
});

const StepSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      id: z.string(),
      type: z.literal('choice'),
      message: z.string(),
      helpText: z.string().optional(),
      choices: z.array(ChoiceSchema),
    }),
    z.object({
      id: z.string(),
      type: z.literal('form'),
      message: z.string(),
      helpText: z.string().optional(),
      fields: z.array(FormFieldSchema),
      nextStepId: z.string(),
    }),
    z.object({
      id: z.string(),
      type: z.literal('info'),
      message: z.string(),
      helpText: z.string().optional(),
      nextStepId: z.string(),
    }),
    z.object({
      id: z.string(),
      type: z.literal('ai_free_text'),
      message: z.string(),
      helpText: z.string().optional(),
      nextStepId: z.string(),
    }),
    z.object({
      id: z.string(),
      type: z.literal('confirm'),
      message: z.string(),
      helpText: z.string().optional(),
      nextStepId: z.string(),
    }),
    z.object({
      id: z.string(),
      type: z.literal('create_ticket'),
      message: z.string(),
      helpText: z.string().optional(),
    }),
  ])
);

const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  enabled: z.boolean(),
  steps: z.record(z.string(), StepSchema),
  startStepId: z.string(),
});

const RequestSchema = z.object({
  flow: FlowSchema,
  stepId: z.string(),
  state: z.record(z.string(), z.unknown()),
  userInput: z
    .object({
      choice: z.string().optional(),
      formData: z.record(z.string(), z.union([z.string(), z.undefined()])).optional(),
      freeText: z.string().optional(),
      confirmed: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { flow, stepId, state, userInput } = parsed.data;
    const result = getNextStep({
      flow: flow as unknown as SupportFlow,
      stepId,
      state,
      userInput,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[support/flow/step]', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
