'use server';
/**
 * Flujo de Genkit para generar informes interpretativos de evaluaciones físicas.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PhysicalTestsSchema = z.record(z.union([z.number(), z.string()])).optional();

const PhysicalAssessmentSchema = z.object({
  id: z.string().optional(),
  date: z.union([z.date(), z.string()]).optional(),
  edad_en_meses: z.number().optional(),
  altura_cm: z.number().optional(),
  peso_kg: z.number().optional(),
  imc: z.number().optional(),
  observaciones_generales: z.string().optional(),
  tests: PhysicalTestsSchema,
  ageGroup: z.string().optional(),
});

const GenerateInterpretiveReportInputSchema = z.object({
  playerName: z.string().describe('Nombre del jugador.'),
  assessments: z.array(PhysicalAssessmentSchema).describe('Lista de evaluaciones físicas del jugador.'),
});
export type GenerateInterpretiveReportInput = z.infer<typeof GenerateInterpretiveReportInputSchema>;

const AnalysisPromptInputSchema = GenerateInterpretiveReportInputSchema.extend({
  assessmentsJson: z.string(),
});

const GenerateInterpretiveReportOutputSchema = z.object({
  report: z.string().describe('Informe interpretativo en Markdown, en español.'),
});
export type GenerateInterpretiveReportOutput = z.infer<typeof GenerateInterpretiveReportOutputSchema>;

export async function generatePhysicalAssessmentInterpretiveReport(
  input: GenerateInterpretiveReportInput
): Promise<GenerateInterpretiveReportOutput> {
  return interpretiveReportFlow(input);
}

const interpretivePrompt = ai.definePrompt({
  name: 'physicalAssessmentInterpretivePrompt',
  input: { schema: AnalysisPromptInputSchema },
  output: { schema: GenerateInterpretiveReportOutputSchema },
  prompt: `
Actúa como un preparador físico y experto en fútbol juvenil.
Genera un informe interpretativo FORMATIVO para el jugador {{playerName}} basado en sus evaluaciones físicas.

**Datos de las evaluaciones:**
{{{assessmentsJson}}}

El informe debe:
1. Estar en español y usar formato Markdown.
2. Incluir un resumen general del perfil físico del jugador.
3. Destacar evolución y tendencias (si hay varias evaluaciones).
4. Señalar fortalezas y áreas de mejora con lenguaje constructivo.
5. Sugerir enfoques de entrenamiento si es relevante.
6. Si hay IMC, interpretar en contexto de edad (sin etiquetar, solo orientación).

Utiliza un tono profesional y alentador. El informe puede ser leído por entrenadores y padres.
  `,
});

const interpretiveReportFlow = ai.defineFlow(
  {
    name: 'physicalAssessmentInterpretiveReport',
    inputSchema: GenerateInterpretiveReportInputSchema,
    outputSchema: GenerateInterpretiveReportOutputSchema,
  },
  async (input) => {
    const assessmentsJson = JSON.stringify(
      input.assessments.map((a) => ({
        ...a,
        date: typeof a.date === 'string' ? a.date : (a.date instanceof Date ? a.date.toISOString() : null),
      })),
      null,
      2
    );
    const promptInput = { ...input, assessmentsJson };
    const { output } = await interpretivePrompt(promptInput);
    if (!output?.report) {
      throw new Error('La IA no generó un informe válido.');
    }
    return { report: output.report };
  }
);
