"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { FilePlus, FileDown, Sparkles, Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Player, PhysicalAssessment, PhysicalAssessmentConfig } from "@/lib/types";
import { useCollection, useDoc } from "@/firebase";
import { AddPhysicalAssessmentSheet } from "./AddPhysicalAssessmentSheet";
import { PhysicalAssessmentDetailDisplay } from "./PhysicalAssessmentDetailDisplay";
import { PhysicalAssessmentEvolutionCharts } from "./PhysicalAssessmentEvolutionCharts";
import { exportPhysicalAssessmentPDF } from "@/lib/physical-assessment-pdf";
import { generatePhysicalAssessmentInterpretiveReport } from "@/ai/flows/physical-assessment-interpretive-report";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface PhysicalAssessmentsTabProps {
  player: Player & { escuelaId: string };
  schoolId: string;
  /** Jugador viendo su perfil: no montar sheet (evita leer physicalAssessmentConfig) ni mostrar botones de crear/analizar. */
  isViewingAsPlayer?: boolean;
}

export function PhysicalAssessmentsTab({ player, schoolId, isViewingAsPlayer = false }: PhysicalAssessmentsTabProps) {
  const { toast } = useToast();
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<PhysicalAssessment | null>(null);
  const [interpretiveReport, setInterpretiveReport] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);

  const { data: assessments, loading: assessmentsLoading, error: assessmentsError } = useCollection<PhysicalAssessment>(
    schoolId ? `schools/${schoolId}/physicalAssessments` : "",
    { where: ["playerId", "==", player.id], orderBy: ["date", "desc"], limit: 50 }
  );
  // Solo staff puede leer la config; un jugador viendo su perfil no tiene permiso.
  const { data: physicalConfig } = useDoc<PhysicalAssessmentConfig>(
    schoolId && !isViewingAsPlayer ? `schools/${schoolId}/physicalAssessmentConfig/default` : ""
  );

  const birthDate = player.birthDate instanceof Date ? player.birthDate : new Date(player.birthDate);
  const playerName = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() || "Jugador";

  const handleGenerateInterpretive = async () => {
    if (!assessments?.length) {
      toast({ variant: "destructive", title: "Sin datos", description: "Necesitas al menos una evaluación física." });
      return;
    }
    setLoadingAI(true);
    setInterpretiveReport(null);
    try {
      const result = await generatePhysicalAssessmentInterpretiveReport({
        playerName,
        assessments: assessments.map((a) => ({
          date: a.date,
          edad_en_meses: a.edad_en_meses,
          altura_cm: a.altura_cm,
          peso_kg: a.peso_kg,
          imc: a.imc,
          observaciones_generales: a.observaciones_generales,
          tests: a.tests as Record<string, string | number> | undefined,
          ageGroup: a.ageGroup,
        })),
      });
      setInterpretiveReport(result.report);
      toast({ title: "Informe generado", description: "El informe interpretativo se ha generado correctamente." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al generar informe",
        description: err instanceof Error ? err.message : "No se pudo generar el informe.",
      });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleExportPDF = () => {
    if (!assessments?.length) {
      toast({ variant: "destructive", title: "Sin datos", description: "Necesitas al menos una evaluación física." });
      return;
    }
    setLoadingPDF(true);
    try {
      exportPhysicalAssessmentPDF(playerName, assessments, interpretiveReport ?? undefined);
      toast({ title: "PDF exportado", description: "El informe se ha descargado correctamente." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al exportar PDF",
        description: err instanceof Error ? err.message : "No se pudo exportar el PDF.",
      });
    } finally {
      setLoadingPDF(false);
    }
  };

  if (assessmentsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      {!isViewingAsPlayer && (
        <AddPhysicalAssessmentSheet
          playerId={player.id}
          schoolId={schoolId}
          birthDate={birthDate}
          playerName={playerName}
          isOpen={isSheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setEditingAssessment(null);
          }}
          editingAssessment={editingAssessment}
        />
      )}

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold font-headline">Evaluaciones Físicas</h2>
          {!isViewingAsPlayer && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSheetOpen(true)}>
              <FilePlus className="mr-2 h-4 w-4" />
              Nueva evaluación
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateInterpretive}
              disabled={!assessments?.length || loadingAI}
            >
              {loadingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Informe IA
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={!assessments?.length || loadingPDF}>
              {loadingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Exportar PDF
            </Button>
          </div>
          )}
        </div>

        {interpretiveReport && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Informe interpretativo (IA)
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{interpretiveReport}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="historial" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="historial" className="gap-2">
              <Activity className="h-4 w-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="evolucion">Evolución</TabsTrigger>
          </TabsList>
          <TabsContent value="historial">
            {assessmentsError ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <h3 className="font-semibold">Error al cargar evaluaciones físicas</h3>
                  <p className="text-muted-foreground mt-2">
                    Posiblemente falte un índice en Firestore. Ejecuta:{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">firebase deploy --only firestore:indexes</code>
                  </p>
                  {!isViewingAsPlayer && (
                    <Button className="mt-4" onClick={() => setSheetOpen(true)}>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Crear evaluación
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : !assessments?.length ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold">Sin evaluaciones físicas</h3>
                  <p className="text-muted-foreground mt-2">
                    Las evaluaciones físicas están disponibles para jugadores entre 5 y 18 años. Añade la primera
                    evaluación.
                  </p>
                  {!isViewingAsPlayer && (
                    <Button className="mt-4" onClick={() => setSheetOpen(true)}>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Crear primera evaluación
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {assessments.map((assessment) => (
                  <AccordionItem value={assessment.id} key={assessment.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4 items-center gap-2">
                        <span className="font-semibold">
                          Evaluación del{" "}
                          {assessment.date
                            ? format(assessment.date instanceof Date ? assessment.date : new Date(assessment.date), "PPP", {
                                locale: es,
                              })
                            : "Fecha desconocida"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Grupo {assessment.ageGroup} · IMC {assessment.imc}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <PhysicalAssessmentDetailDisplay
                        assessment={assessment}
                        schoolId={schoolId}
                        physicalConfig={physicalConfig}
                        onDeleted={() => {}}
                        onEditClick={(a) => {
                          setEditingAssessment(a);
                          setSheetOpen(true);
                        }}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
          <TabsContent value="evolucion">
            {!assessments?.length ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold">Evolución física</h3>
                  <p className="text-muted-foreground mt-2">
                    Necesitas al menos una evaluación física para ver la evolución. Añade evaluaciones en la pestaña
                    Historial.
                  </p>
                  {!isViewingAsPlayer && (
                    <Button className="mt-4" onClick={() => setSheetOpen(true)}>
                      <FilePlus className="mr-2 h-4 w-4" />
                      Nueva evaluación
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <PhysicalAssessmentEvolutionCharts assessments={assessments} physicalConfig={physicalConfig} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
