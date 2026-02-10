'use server';
/**
 * Flujo de Genkit para mejorar los comentarios del entrenador.
 * Usa el primer modelo Gemini disponible con tu API key.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { getAvailableGeminiModel } from '@/ai/get-available-gemini-model';

const ImproveCoachCommentsInputSchema = z.object({
  playerName: z.string().describe('Nombre del jugador.'),
  previousEvaluationsSummary: z.string().describe('Resumen en texto de evaluaciones anteriores: fecha y comentarios.'),
  currentDraft: z.string().describe('Borrador actual del comentario (puede ser transcripción de voz o texto escrito).'),
});

const ImproveCoachCommentsOutputSchema = z.object({
  improvedText: z.string().describe('Texto mejorado, coherente y bien redactado para los comentarios del entrenador.'),
});

export type ImproveCoachCommentsInput = z.infer<typeof ImproveCoachCommentsInputSchema>;
export type ImproveCoachCommentsOutput = z.infer<typeof ImproveCoachCommentsOutputSchema>;

export async function improveCoachCommentsWithAI(
  input: ImproveCoachCommentsInput
): Promise<ImproveCoachCommentsOutput> {
  return improveFlow(input);
}

const improvePrompt = ai.definePrompt({
  name: 'improveCoachCommentsPrompt',
  input: { schema: ImproveCoachCommentsInputSchema },
  output: { schema: ImproveCoachCommentsOutputSchema },
  prompt: `
Eres un entrenador experto de la Escuela de River Plate. Tu tarea es redactar un único párrafo para la sección "Comentarios del Entrenador" de una evaluación del jugador {{playerName}}.

**Contexto:** Tienes acceso al historial de comentarios de evaluaciones anteriores de este jugador y al borrador actual que el entrenador escribió o dictó (puede tener errores de transcripción o estar en bruto).

**Historial de evaluaciones anteriores:**
{{previousEvaluationsSummary}}

**Borrador actual del entrenador (texto o transcripción de voz):**
{{currentDraft}}

**Instrucciones:**
- Genera UN solo párrafo (o dos cortos si es necesario), en español, que resuma de forma clara y profesional el rendimiento, actitud y áreas de mejora.
- Incorpora la información del borrador actual y, si es útil, la continuidad con evaluaciones anteriores (evolución, consistencia).
- Corrige errores de transcripción, une ideas sueltas y mejora la redacción sin inventar datos.
- Tono: profesional, constructivo y alineado con la formación juvenil de River Plate.
- No uses listas con viñetas; el resultado debe ser texto corrido para pegar en el campo "Comentarios del Entrenador".
- Si el borrador está vacío o es muy breve, genera igualmente un comentario coherente basado solo en el historial si hay datos; si no hay nada, devuelve un párrafo genérico y alentador.

Devuelve únicamente el texto mejorado, sin títulos ni prefijos.
  `,
});

const improveFlow = ai.defineFlow(
  {
    name: 'improveCoachCommentsFlow',
    inputSchema: ImproveCoachCommentsInputSchema,
    outputSchema: ImproveCoachCommentsOutputSchema,
  },
  async (input) => {
    const modelName = await getAvailableGeminiModel();
    if (!modelName) {
      throw new Error(
        'No se encontró ningún modelo Gemini disponible. Verificá GEMINI_API_KEY en .env.local (API key de https://aistudio.google.com/apikey).'
      );
    }
    const { output } = await improvePrompt(input, {
      model: googleAI.model(modelName),
    });
    if (!output?.improvedText) {
      throw new Error('La IA no generó un texto válido.');
    }
    return { improvedText: output.improvedText };
  }
);

// --- Comentario por rubro (una frase corta) ---

const ImproveRubricCommentInputSchema = z.object({
  playerName: z.string().describe('Nombre del jugador.'),
  rubricLabel: z.string().describe('Nombre del rubro, ej. Control de Balón, Pase.'),
  currentDraft: z.string().describe('Borrador del comentario para este rubro (puede ser voz o texto).'),
});

const ImproveRubricCommentOutputSchema = z.object({
  improvedText: z.string().describe('Una frase o comentario corto mejorado para el rubro.'),
});

export type ImproveRubricCommentInput = z.infer<typeof ImproveRubricCommentInputSchema>;
export type ImproveRubricCommentOutput = z.infer<typeof ImproveRubricCommentOutputSchema>;

export async function improveRubricCommentWithAI(
  input: ImproveRubricCommentInput
): Promise<ImproveRubricCommentOutput> {
  return improveRubricFlow(input);
}

const improveRubricPrompt = ai.definePrompt({
  name: 'improveRubricCommentPrompt',
  input: { schema: ImproveRubricCommentInputSchema },
  output: { schema: ImproveRubricCommentOutputSchema },
  prompt: `
Eres un entrenador experto de la Escuela de River Plate. Tu tarea es redactar UNA FRASE CORTA para el comentario opcional del rubro "{{rubricLabel}}" en la evaluación del jugador {{playerName}}.

**Borrador del entrenador (puede ser transcripción de voz o texto suelto):**
{{currentDraft}}

**Instrucciones:**
- Genera una sola frase (o dos muy breves), en español, que describa el rendimiento en ese rubro.
- Corrige errores de transcripción y mejora la redacción sin inventar datos.
- Tono: profesional y constructivo. Si el borrador está vacío, devuelve una frase genérica breve tipo "En progreso" o "Trabajar en este aspecto".
- Sin títulos ni prefijos; solo el texto listo para pegar en el campo del rubro.
  `,
});

const improveRubricFlow = ai.defineFlow(
  {
    name: 'improveRubricCommentFlow',
    inputSchema: ImproveRubricCommentInputSchema,
    outputSchema: ImproveRubricCommentOutputSchema,
  },
  async (input) => {
    const modelName = await getAvailableGeminiModel();
    if (!modelName) {
      throw new Error(
        'No se encontró ningún modelo Gemini disponible. Verificá GEMINI_API_KEY en .env.local.'
      );
    }
    const { output } = await improveRubricPrompt(input, {
      model: googleAI.model(modelName),
    });
    if (!output?.improvedText) {
      throw new Error('La IA no generó un texto válido.');
    }
    return { improvedText: output.improvedText };
  }
);
