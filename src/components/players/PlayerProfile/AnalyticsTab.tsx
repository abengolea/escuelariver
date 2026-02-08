"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Player, Evaluation } from '@/lib/types';
import { generateComparativeAnalysis, type GenerateComparativeAnalysisInput } from '@/ai/flows/physical-assessment-comparative-analytics';
import ReactMarkdown from 'react-markdown';


interface AnalyticsTabProps {
  player: Player;
  evaluations: Evaluation[];
}

// Datos de ejemplo para la comparación. En una app real, esto vendría de la base de datos (promedio de categoría, etc.)
const comparisonDataExample = {
  physical: {
    speed20m: { value: 3.5, unit: 's' },
    resistanceBeepTest: { value: 8, unit: 'level' },
  },
  technical: {
    control: 4,
    pase: 3,
    definicion: 3,
  },
  tactical: {
    posicionamiento: 4,
    tomaDeDecision: 3,
  }
};


export function AnalyticsTab({ player, evaluations }: AnalyticsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');

  const handleGenerateAnalysis = async () => {
    setLoading(true);
    setAnalysisResult('');

    const latestEvaluation = evaluations?.[0];

    if (!latestEvaluation) {
      toast({
        variant: 'destructive',
        title: 'Datos insuficientes',
        description: 'No hay evaluaciones recientes para generar un análisis.',
      });
      setLoading(false);
      return;
    }
    
    const input: GenerateComparativeAnalysisInput = {
        playerName: `${player.firstName} ${player.lastName}`,
        playerData: {
            physical: latestEvaluation.physical,
            technical: latestEvaluation.technical,
            tactical: latestEvaluation.tactical,
        },
        comparisonData: comparisonDataExample,
        comparisonContext: "el promedio de su categoría de edad"
    };

    try {
      const result = await generateComparativeAnalysis(input);
      setAnalysisResult(result.analysis);
    } catch (error) {
      console.error('Error generando el análisis de IA:', error);
      toast({
        variant: 'destructive',
        title: 'Error de IA',
        description: 'No se pudo generar el análisis. Por favor, inténtalo de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline">
          <Sparkles className="text-primary" />
          Análisis Comparativo con IA
        </CardTitle>
        <CardDescription>
          Genera un borrador de análisis comparando la última evaluación del jugador con el promedio de su categoría.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-start">
          <Button onClick={handleGenerateAnalysis} disabled={loading || evaluations.length === 0}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Generando...' : 'Generar Análisis'}
          </Button>
        </div>
        
          <div className="prose prose-sm dark:prose-invert max-w-none p-4 border rounded-md min-h-[250px] bg-muted/50">
            {loading ? (
              <div className='flex items-center justify-center h-full text-muted-foreground'>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                La IA está analizando los datos...
              </div>
            ) : analysisResult ? (
              <ReactMarkdown>{analysisResult}</ReactMarkdown>
            ) : (
               <div className='flex items-center justify-center h-full text-muted-foreground'>
                <p>El análisis generado por la IA aparecerá aquí...</p>
               </div>
            )}
          </div>
          {analysisResult && (
              <div className='mt-4 flex gap-2'>
                  <Button>Aprobar y Guardar Informe</Button>
                  <Button variant="outline">Editar</Button>
              </div>
          )}
       
      </CardContent>
    </Card>
  );
}
