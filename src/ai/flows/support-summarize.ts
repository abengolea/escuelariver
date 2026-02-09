'use server';
/**
 * Flujo Genkit para soporte: resume texto libre del usuario y extrae categoría, severidad, tags y campos faltantes.
 * Uso: solo cuando el usuario escribe texto libre o antes de crear ticket.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { SupportAiExtraction, SupportCategory, TicketSeverity } from '@/lib/types';

const SupportSummarizeInputSchema = z.object({
  freeText: z.string().describe('Texto libre que el usuario escribió describiendo su problema.'),
  contextHint: z.string().optional().describe('Categoría o flujo actual si ya se conoce.'),
});

const SupportSummarizeOutputSchema = z.object({
  summary: z.string().describe('Resumen breve del problema en una o dos frases.'),
  category: z.enum([
    'login_access', 'permissions', 'player_edit', 'video_upload',
    'reports', 'payments_ui', 'performance', 'bug_report', 'other'
  ]).describe('Categoría más adecuada.'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severidad del problema.'),
  suggestedTags: z.array(z.string()).describe('Etiquetas sugeridas para el ticket (ej. login, video, report).'),
  missingFields: z.array(z.string()).describe('Campos que faltarían para el ticket: playerId, device, reproSteps, etc.'),
});

export type SupportSummarizeInput = z.infer<typeof SupportSummarizeInputSchema>;
export type SupportSummarizeOutput = z.infer<typeof SupportSummarizeOutputSchema>;

export async function supportSummarizeAndExtract(
  input: SupportSummarizeInput
): Promise<SupportAiExtraction> {
  const result = await supportSummarizeFlow(input);
  return {
    summary: result.summary,
    category: result.category as SupportCategory,
    severity: result.severity as TicketSeverity,
    suggestedTags: result.suggestedTags,
    missingFields: result.missingFields,
  };
}

const supportSummarizePrompt = ai.definePrompt({
  name: 'supportSummarizePrompt',
  input: { schema: SupportSummarizeInputSchema },
  output: { schema: SupportSummarizeOutputSchema },
  prompt: `
Eres un asistente de clasificación de tickets de soporte para una app web multi-tenant de escuelas de fútbol (Escuelas River). El usuario describe un problema en texto libre.

**Texto del usuario:**
{{freeText}}
{{#if contextHint}}**Contexto conocido:** {{contextHint}}{{/if}}

**Instrucciones:**
- Genera un **summary** breve (1-2 frases) del problema en español.
- Asigna **category** exactamente una de: login_access, permissions, player_edit, video_upload, reports, payments_ui, performance, bug_report, other.
- Asigna **severity**: low (consulta general), medium (molestia), high (bloquea uso parcial), critical (bloquea acceso total).
- **suggestedTags**: array de etiquetas cortas en minúsculas (ej. ["login", "video", "timeout"]).
- **missingFields**: array de nombres de campos que un operador necesitaría y que no están claros en el texto: por ejemplo "playerId", "device", "reproSteps", "affectedPlayerId", "route".

Responde únicamente con el JSON válido según el esquema (summary, category, severity, suggestedTags, missingFields). Sin markdown ni texto extra.
  `,
});

const supportSummarizeFlow = ai.defineFlow(
  {
    name: 'supportSummarizeFlow',
    inputSchema: SupportSummarizeInputSchema,
    outputSchema: SupportSummarizeOutputSchema,
  },
  async (input) => {
    const { output } = await supportSummarizePrompt(input);
    if (!output) {
      throw new Error('La IA no devolvió una respuesta válida.');
    }
    return output;
  }
);
