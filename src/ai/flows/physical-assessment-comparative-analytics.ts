'use server';
/**
 * @fileOverview Flujo de Genkit para analizar y comparar evaluaciones de jugadores.
 *
 * - generateComparativeAnalysis: Genera un análisis comparativo de un jugador.
 * - GenerateComparativeAnalysisInput: Tipo de entrada para la función.
 * - GenerateComparativeAnalysisOutput: Tipo de salida para la función.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Definición de esquemas de datos para la entrada y salida de la IA
const PhysicalDataSchema = z.object({
    height: z.object({ value: z.number(), unit: z.string() }).optional(),
    weight: z.object({ value: z.number(), unit: z.string() }).optional(),
    speed20m: z.object({ value: z.number(), unit: z.string() }).optional(),
    resistanceBeepTest: z.object({ value: z.number(), unit: z.string() }).optional(),
    agilityTest: z.object({ value: z.number(), unit: z.string() }).optional(),
}).optional();

const TechnicalDataSchema = z.record(z.number().min(1).max(5)).optional();
const TacticalDataSchema = z.record(z.number().min(1).max(5)).optional();

const PlayerEvalDataSchema = z.object({
  physical: PhysicalDataSchema,
  technical: TechnicalDataSchema,
  tactical: TacticalDataSchema,
});


const GenerateComparativeAnalysisInputSchema = z.object({
  playerName: z.string().describe('Nombre del jugador a analizar.'),
  playerData: PlayerEvalDataSchema.describe('Datos de la evaluación más reciente del jugador.'),
  comparisonData: PlayerEvalDataSchema.describe('Datos de la evaluación con la que se debe comparar (ej. promedio de la categoría).'),
  comparisonContext: z.string().describe('Contexto de los datos de comparación (ej. "el promedio de su categoría", "un jugador de élite", etc.).')
});
export type GenerateComparativeAnalysisInput = z.infer<typeof GenerateComparativeAnalysisInputSchema>;

// Schema extendido para el prompt: incluye versiones JSON stringificadas (Genkit no ejecuta JS en la plantilla).
const AnalysisPromptInputSchema = GenerateComparativeAnalysisInputSchema.extend({
  playerDataPhysicalJson: z.string(),
  playerDataTechnicalJson: z.string(),
  playerDataTacticalJson: z.string(),
  comparisonDataPhysicalJson: z.string(),
  comparisonDataTechnicalJson: z.string(),
  comparisonDataTacticalJson: z.string(),
});


const GenerateComparativeAnalysisOutputSchema = z.object({
  analysis: z.string().describe('Análisis de texto detallado, constructivo y en español, con formato Markdown. Debe incluir fortalezas, áreas de mejora y un resumen general.'),
});
export type GenerateComparativeAnalysisOutput = z.infer<typeof GenerateComparativeAnalysisOutputSchema>;


export async function generateComparativeAnalysis(input: GenerateComparativeAnalysisInput): Promise<GenerateComparativeAnalysisOutput> {
  return analysisFlow(input);
}


// Definición del Prompt de Genkit (usa variables pre-serializadas; Genkit no ejecuta JS en la plantilla).
const analysisPrompt = ai.definePrompt({
  name: 'playerAnalysisPrompt',
  input: { schema: AnalysisPromptInputSchema },
  output: { schema: GenerateComparativeAnalysisOutputSchema },
  prompt: `
    Actúa como un director deportivo y entrenador experto en fútbol juvenil.
    Tu tarea es redactar un análisis comparativo CONSTRUCTIVO y FORMATIVO para el jugador {{playerName}}.

    Analiza los datos de su última evaluación y compáralos con los datos de referencia proporcionados, que representan {{comparisonContext}}.

    El informe debe estar en español, usar formato Markdown y estructurarse de la siguiente manera:

    **1. Resumen General:**
    Un párrafo introductorio que resuma el perfil del jugador basado en la data.

    **2. Fortalezas Destacadas:**
    Una lista (usando viñetas) de 2-3 puntos donde el jugador destaca en comparación con la referencia. Sé específico y usa los datos.
    Por ejemplo: "Su velocidad en 20 metros (valor en physical.speed20m) es notablemente superior al promedio, lo que le da una ventaja en ataques rápidos."

    **3. Áreas de Enfoque para el Desarrollo:**
    Una lista (usando viñetas) de 2-3 áreas donde hay oportunidad de mejora. El lenguaje debe ser de apoyo y orientado a la acción, no negativo.
    Por ejemplo: "Existe una buena oportunidad para mejorar la consistencia en el pase (revisar datos técnicos), lo que potenciará su capacidad para construir juego."

    **4. Conclusión y Próximos Pasos:**
    Un párrafo final que ofrezca ánimo y sugiera un enfoque para los próximos entrenamientos.

    Utiliza un tono profesional, alentador y alineado con los valores formativos en fútbol.
    NO uses jerga excesivamente técnica. El informe puede ser leído por entrenadores y, eventualmente, por los padres.

    **Datos del Jugador ({{playerName}}):**
    - Físico: {{{playerDataPhysicalJson}}}
    - Técnico: {{{playerDataTechnicalJson}}}
    - Táctico: {{{playerDataTacticalJson}}}

    **Datos de Comparación ({{comparisonContext}}):**
    - Físico: {{{comparisonDataPhysicalJson}}}
    - Técnico: {{{comparisonDataTechnicalJson}}}
    - Táctico: {{{comparisonDataTacticalJson}}}
  `,
});


// Definición del Flujo de Genkit
const analysisFlow = ai.defineFlow(
  {
    name: 'playerAnalysisFlow',
    inputSchema: GenerateComparativeAnalysisInputSchema,
    outputSchema: GenerateComparativeAnalysisOutputSchema,
  },
  async (input) => {
    const promptInput = {
      ...input,
      playerDataPhysicalJson: JSON.stringify(input.playerData?.physical ?? {}),
      playerDataTechnicalJson: JSON.stringify(input.playerData?.technical ?? {}),
      playerDataTacticalJson: JSON.stringify(input.playerData?.tactical ?? {}),
      comparisonDataPhysicalJson: JSON.stringify(input.comparisonData?.physical ?? {}),
      comparisonDataTechnicalJson: JSON.stringify(input.comparisonData?.technical ?? {}),
      comparisonDataTacticalJson: JSON.stringify(input.comparisonData?.tactical ?? {}),
    };
    const { output } = await analysisPrompt(promptInput);
    if (!output) {
      throw new Error("La IA no generó una respuesta válida.");
    }
    return output;
  }
);
