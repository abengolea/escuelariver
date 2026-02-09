/**
 * Motor de flujo de soporte (config-driven).
 * Toma flowId, stepId, state y userInput y devuelve el siguiente paso y estado actualizado.
 * Diseñado para ejecutarse en cliente (lee supportFlows desde Firestore).
 */

import type {
  SupportFlow,
  SupportFlowStep,
  SupportFlowStepChoice,
  SupportFlowStepForm,
  SupportFlowStepInfo,
  SupportFlowStepAiFreeText,
  SupportFlowStepConfirm,
  SupportFlowStepCreateTicket,
} from '@/lib/types';

export interface FlowEngineInput {
  flow: SupportFlow;
  stepId: string;
  state: Record<string, unknown>;
  userInput?: {
    choice?: string;
    formData?: Record<string, string | undefined>;
    freeText?: string;
    confirmed?: boolean;
  };
}

export interface FlowEngineResult {
  nextStep: SupportFlowStep | null;
  nextStepId: string | null;
  updatedState: Record<string, unknown>;
  done: boolean;
  createTicket: boolean;
}

function getStep(flow: SupportFlow, stepId: string): SupportFlowStep | null {
  const step = flow.steps[stepId];
  return step ?? null;
}

/**
 * Dado el paso actual y la entrada del usuario, calcula el siguiente paso y el estado actualizado.
 */
export function getNextStep(input: FlowEngineInput): FlowEngineResult {
  const { flow, stepId, state, userInput } = input;
  const step = getStep(flow, stepId);
  if (!step) {
    return {
      nextStep: null,
      nextStepId: null,
      updatedState: { ...state },
      done: true,
      createTicket: false,
    };
  }

  const updatedState: Record<string, unknown> = { ...state, lastStepId: stepId };

  switch (step.type) {
    case 'choice': {
      const choiceStep = step as SupportFlowStepChoice;
      const selected = userInput?.choice;
      const option = choiceStep.choices.find((c) => c.value === selected);
      const nextId = option?.nextStepId ?? null;
      const nextStep = nextId ? getStep(flow, nextId) : null;
      if (selected) {
        updatedState[`choice_${stepId}`] = selected;
      }
      return {
        nextStep,
        nextStepId: nextId,
        updatedState,
        done: !nextId,
        createTicket: nextStep?.type === 'create_ticket',
      };
    }

    case 'form': {
      const formStep = step as SupportFlowStepForm;
      const formData = userInput?.formData ?? {};
      const nextId = formStep.nextStepId;
      const nextStep = getStep(flow, nextId);
      formStep.fields.forEach((f) => {
        if (formData[f.key] !== undefined) {
          (updatedState as Record<string, unknown>)[f.key] = formData[f.key];
        }
      });
      return {
        nextStep: nextStep ?? null,
        nextStepId: nextId,
        updatedState,
        done: !nextId,
        createTicket: nextStep?.type === 'create_ticket',
      };
    }

    case 'info': {
      const infoStep = step as SupportFlowStepInfo;
      const nextStep = getStep(flow, infoStep.nextStepId);
      return {
        nextStep,
        nextStepId: infoStep.nextStepId,
        updatedState,
        done: false,
        createTicket: nextStep?.type === 'create_ticket',
      };
    }

    case 'ai_free_text': {
      const aiStep = step as SupportFlowStepAiFreeText;
      if (userInput?.freeText) {
        (updatedState as Record<string, unknown>).freeText = userInput.freeText;
      }
      const nextStep = getStep(flow, aiStep.nextStepId);
      return {
        nextStep,
        nextStepId: aiStep.nextStepId,
        updatedState,
        done: false,
        createTicket: nextStep?.type === 'create_ticket',
      };
    }

    case 'confirm': {
      const confirmStep = step as SupportFlowStepConfirm;
      const confirmed = userInput?.confirmed === true;
      const nextId = confirmed ? confirmStep.nextStepId : null;
      const nextStep = nextId ? getStep(flow, nextId) : null;
      (updatedState as Record<string, unknown>).confirmed = confirmed;
      return {
        nextStep: nextStep ?? null,
        nextStepId: nextId,
        updatedState,
        done: !nextId,
        createTicket: nextStep?.type === 'create_ticket',
      };
    }

    case 'create_ticket': {
      return {
        nextStep: null,
        nextStepId: null,
        updatedState,
        done: true,
        createTicket: true,
      };
    }

    default:
      return {
        nextStep: null,
        nextStepId: null,
        updatedState,
        done: true,
        createTicket: false,
      };
  }
}

/**
 * Obtiene el paso inicial del flujo.
 */
export function getStartStep(flow: SupportFlow): SupportFlowStep | null {
  return getStep(flow, flow.startStepId);
}
