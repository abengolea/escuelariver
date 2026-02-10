'use server';
/**
 * Flujo de Genkit para ayudar a redactar el asunto y el cuerpo de un mensaje masivo
 * a jugadores (chicos) de la escuela. Mejora tono, claridad y brevedad.
 * Usa el primer modelo Gemini disponible con tu API key (evita NOT_FOUND por región/cuenta).
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { getAvailableGeminiModel } from '@/ai/get-available-gemini-model';

const ImproveMassMessageInputSchema = z.object({
  subject: z.string().describe('Asunto actual del mensaje (puede estar vacío).'),
  body: z.string().describe('Borrador actual del mensaje (puede estar vacío o ser una idea suelta).'),
});

const ImproveMassMessageOutputSchema = z.object({
  subject: z.string().describe('Asunto mejorado, breve y claro.'),
  body: z.string().describe('Cuerpo del mensaje mejorado: claro, cordial y apropiado para familias/jugadores.'),
});

export type ImproveMassMessageInput = z.infer<typeof ImproveMassMessageInputSchema>;
export type ImproveMassMessageOutput = z.infer<typeof ImproveMassMessageOutputSchema>;

export async function improveMassMessageWithAI(
  input: ImproveMassMessageInput
): Promise<ImproveMassMessageOutput> {
  return improveMassMessageFlow(input);
}

const improveMassMessagePrompt = ai.definePrompt({
  name: 'improveMassMessagePrompt',
  input: { schema: ImproveMassMessageInputSchema },
  output: { schema: ImproveMassMessageOutputSchema },
  prompt: `
Eres un asistente de comunicación de la Escuela de Fútbol de River Plate. Tu tarea es redactar o mejorar un mensaje que el administrador de la escuela enviará por correo a los jugadores (chicos) y sus familias.

**Asunto actual (puede estar vacío):**
{{subject}}

**Borrador del mensaje (puede estar vacío o ser solo una idea):**
{{body}}

**Instrucciones:**
- Genera un asunto breve (máximo una línea) y un cuerpo de mensaje claro y cordial.
- Tono: cercano, profesional y apropiado para familias y chicos (evitar jerga administrativa).
- Si el borrador está vacío, sugiere un mensaje genérico de novedades o recordatorio (por ejemplo próximo entrenamiento, aviso importante).
- Si ya hay texto, mejora redacción, ortografía y estructura sin cambiar el sentido; puedes acortar o expandir un poco si mejora la claridad.
- El cuerpo debe ser texto plano, con párrafos separados por líneas en blanco; no uses listas con viñetas a menos que sea muy útil.
- Responde únicamente en español.
- Devuelve exactamente dos campos: subject (asunto) y body (cuerpo del mensaje).
  `,
});

const improveMassMessageFlow = ai.defineFlow(
  {
    name: 'improveMassMessageFlow',
    inputSchema: ImproveMassMessageInputSchema,
    outputSchema: ImproveMassMessageOutputSchema,
  },
  async (input) => {
    const modelName = await getAvailableGeminiModel();
    if (!modelName) {
      throw new Error(
        'No se encontró ningún modelo Gemini disponible. Verificá que GEMINI_API_KEY (o GOOGLE_API_KEY) en .env.local sea una API key de Google AI Studio: https://aistudio.google.com/apikey'
      );
    }
    const { output } = await improveMassMessagePrompt(input, {
      model: googleAI.model(modelName),
    });
    if (!output?.subject || output.body === undefined) {
      throw new Error('La IA no generó una respuesta válida.');
    }
    return { subject: output.subject, body: output.body };
  }
);
