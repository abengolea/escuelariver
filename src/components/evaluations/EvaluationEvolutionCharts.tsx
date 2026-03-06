"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvolutionChart } from "@/components/charts/EvolutionChart";
import type { Evaluation } from "@/lib/types";

const skillLabels: Record<string, string> = {
  manejo: "Manejo de balón",
  control: "Control de Balón",
  pase: "Pase",
  tiro: "Tiro / Finalización",
  definicion: "Definición",
  dribbling: "Dribbling",
  posicionamiento: "Posicionamiento",
  tomaDeDecision: "Toma de Decisión",
  defensa: "Defensa / Presión",
  presion: "Presión y Recuperación",
  respect: "Respeto",
  responsibility: "Responsabilidad",
  teamwork: "Compañerismo",
  resilience: "Resiliencia",
  learningAttitude: "Actitud de aprendizaje",
  height: "Estatura (cm)",
  weight: "Peso (kg)",
  speed20m: "Velocidad 20m (s)",
  resistanceBeepTest: "Test Beep (nivel)",
  agilityTest: "Agilidad (s)",
};

interface EvaluationEvolutionChartsProps {
  evaluations: Evaluation[];
  /** Nombre de la pestaña donde añadir evaluaciones (para el mensaje cuando no hay gráficos). Por defecto "Evaluaciones". */
  emptyStateRefTab?: string;
}

function seriesFromEvaluations(
  evaluations: Evaluation[],
  getValue: (e: Evaluation) => number | undefined
): { date: Date; value: number }[] {
  const sorted = [...evaluations].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return sorted
    .map((e) => {
      const value = getValue(e);
      if (value === undefined || value === null) return null;
      return { date: e.date instanceof Date ? e.date : new Date(e.date), value };
    })
    .filter((item): item is { date: Date; value: number } => item != null);
}

export function EvaluationEvolutionCharts({ evaluations, emptyStateRefTab = "Evaluaciones" }: EvaluationEvolutionChartsProps) {
  if (!evaluations?.length) return null;

  const flatSeries: { key: string; label: string; data: { date: Date; value: number }[] }[] = [];

  // Técnica
  const technicalKeys = new Set<string>();
  evaluations.forEach((e) => e.technical && Object.keys(e.technical).forEach((k) => technicalKeys.add(k)));
  technicalKeys.forEach((key) => {
    const data = seriesFromEvaluations(evaluations, (e) => e.technical?.[key]);
    if (data.length >= 2)
      flatSeries.push({ key, label: skillLabels[key] || key, data });
  });

  // Táctica
  const tacticalKeys = new Set<string>();
  evaluations.forEach((e) => e.tactical && Object.keys(e.tactical).forEach((k) => tacticalKeys.add(k)));
  tacticalKeys.forEach((key) => {
    const data = seriesFromEvaluations(evaluations, (e) => e.tactical?.[key]);
    if (data.length >= 2)
      flatSeries.push({ key, label: skillLabels[key] || key, data });
  });

  // Socio-emocional
  const socioKeys = new Set<string>();
  evaluations.forEach((e) => e.socioEmotional && Object.keys(e.socioEmotional).forEach((k) => socioKeys.add(k)));
  socioKeys.forEach((key) => {
    const data = seriesFromEvaluations(evaluations, (e) => (e.socioEmotional as Record<string, number> | undefined)?.[key]);
    if (data.length >= 2)
      flatSeries.push({ key, label: skillLabels[key] || key, data });
  });

  // Físico
  const physicalKeys = ["height", "weight", "speed20m", "resistanceBeepTest", "agilityTest"] as const;
  physicalKeys.forEach((key) => {
    const data = seriesFromEvaluations(evaluations, (e) => e.physical?.[key]?.value);
    if (data.length >= 2)
      flatSeries.push({ key, label: skillLabels[key] || key, data });
  });

  if (flatSeries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Seguimiento en el tiempo</CardTitle>
          <CardDescription>
            Cuando haya al menos dos evaluaciones con la misma métrica, aquí aparecerán los gráficos de evolución.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Añade más evaluaciones en la pestaña {emptyStateRefTab} para ver la evolución de cada habilidad.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Seguimiento en el tiempo</CardTitle>
        <CardDescription>
          Evolución de las métricas de evaluación. Se muestran solo las que tienen al menos dos fechas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {flatSeries.map(({ key, label, data }) => (
          <div key={key}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{label}</h4>
            <EvolutionChart
              data={data}
              dataKey="value"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
