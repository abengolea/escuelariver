"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Evaluation } from "@/lib/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EvaluationDetailDisplayProps {
  evaluation: Evaluation;
}

const skillLabels: Record<string, string> = {
    control: "Control de Balón",
    pase: "Pase",
    definicion: "Definición",
    dribbling: "Dribbling",
    posicionamiento: "Posicionamiento",
    tomaDeDecision: "Toma de Decisión",
    presion: "Presión y Recuperación",
    respect: "Respeto",
    responsibility: "Responsabilidad",
    teamwork: "Compañerismo",
    resilience: "Resiliencia",
};

export function EvaluationDetailDisplay({ evaluation }: EvaluationDetailDisplayProps) {
    
    const renderSkill = (skillName: string, value?: number) => (
        <div key={skillName} className="flex justify-between items-center text-sm py-1">
            <span className="text-muted-foreground">{skillLabels[skillName] || skillName}</span>
            <span className="font-mono font-semibold">{value ?? "N/A"}</span>
        </div>
    );

    return (
        <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
            <Card>
                 <CardHeader>
                    <CardTitle className="font-headline text-xl">
                        Evaluación del {format(evaluation.date, "d 'de' MMMM 'de' yyyy", { locale: es })}
                    </CardTitle>
                    <CardDescription>
                        Comentarios y calificaciones de la sesión.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <h4 className="font-semibold mb-2">Comentarios del Entrenador</h4>
                        <p className="text-sm text-muted-foreground italic">
                            {evaluation.coachComments || "Sin comentarios."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
                {evaluation.technical && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Técnica</CardTitle>
                        </CardHeader>
                        <CardContent>
                           {Object.entries(evaluation.technical).map(([key, value]) => renderSkill(key, value))}
                        </CardContent>
                    </Card>
                )}
                {evaluation.tactical && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Táctica</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.entries(evaluation.tactical).map(([key, value]) => renderSkill(key, value))}
                        </CardContent>
                    </Card>
                )}
                {evaluation.socioEmotional && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Socio-emocional</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.entries(evaluation.socioEmotional).map(([key, value]) => renderSkill(key, value))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
