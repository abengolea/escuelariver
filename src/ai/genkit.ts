import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Pasar la API key explícitamente para que Next.js la inyecte desde .env.local
const apiKey =
  process.env.GEMINI_API_KEY ??
  process.env.GOOGLE_API_KEY ??
  process.env.GOOGLE_GENAI_API_KEY;

// Solo registrar el plugin cuando hay key; si no, la página carga y "Mejorar con IA" falla con mensaje claro
// Usar googleAI.model() para el modelo; el string solo es el nombre del modelo (sin prefijo "googleai/")
export const ai = genkit({
  plugins: apiKey ? [googleAI({ apiKey })] : [],
  model: apiKey ? googleAI.model('gemini-1.5-flash') : undefined,
});
