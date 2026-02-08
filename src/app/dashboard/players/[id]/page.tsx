"use client";

import { notFound, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cake, User, Contact, Bot, FilePlus } from "lucide-react";
import { calculateAge } from "@/lib/utils";
import { useDoc, useUserProfile, useCollection } from "@/firebase";
import type { Player, Evaluation } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTab } from "@/components/players/PlayerProfile/SummaryTab";
import { AnalyticsTab } from "@/components/players/PlayerProfile/AnalyticsTab";
import { useState } from "react";
import { AddEvaluationSheet } from "@/components/evaluations/AddEvaluationSheet";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EvaluationDetailDisplay } from "@/components/evaluations/EvaluationDetailDisplay";

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { activeSchoolId, isReady: profileReady } = useUserProfile();
  const [isEvalSheetOpen, setEvalSheetOpen] = useState(false);
  
  const { data: player, loading: playerLoading } = useDoc<Player>(
      profileReady && activeSchoolId ? `schools/${activeSchoolId}/players/${id}` : ''
  );

  const { data: evaluations, loading: evalsLoading } = useCollection<Evaluation>(
    profileReady && activeSchoolId ? `schools/${activeSchoolId}/evaluations` : '',
    { where: ['playerId', '==', id], orderBy: ['date', 'desc'], limit: 20 }
  );

  const isLoading = playerLoading || !profileReady || evalsLoading;

  if (isLoading) {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col md:flex-row gap-6">
                <Skeleton className="h-32 w-32 rounded-full" />
                <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-24 rounded" />
                    <Skeleton className="h-10 w-1/2 rounded" />
                    <Skeleton className="h-6 w-1/3 rounded" />
                     <div className="mt-4 flex items-center gap-4">
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-5 w-20 rounded" />
                        <Skeleton className="h-5 w-20 rounded" />
                     </div>
                </div>
            </header>
            <Skeleton className="h-10 w-full max-w-md rounded-md" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
  }

  if (!player) {
    notFound();
  }
  
  const playerWithSchool = { ...player, escuelaId: activeSchoolId! };

  return (
    <>
    <AddEvaluationSheet
      playerId={id}
      schoolId={activeSchoolId!}
      isOpen={isEvalSheetOpen}
      onOpenChange={setEvalSheetOpen}
    />
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row gap-6">
        <Avatar className="h-32 w-32 border-4 border-card">
          <AvatarImage src={player.photoUrl} data-ai-hint="person portrait" />
          <AvatarFallback className="text-4xl">{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Badge 
            variant={
              player.status === "active"
                ? "secondary"
                : "destructive"
            }
            className={`mb-2 capitalize ${player.status === "active" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""}`}
          >
            {player.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
          <h1 className="text-4xl font-bold font-headline">{player.firstName} {player.lastName}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
             <div className="flex items-center gap-1"><Cake className="h-4 w-4" /> {calculateAge(player.birthDate)} años</div>
             <div className="flex items-center gap-1"><User className="h-4 w-4" /> Tutor: {player.tutorContact.name}</div>
             <div className="flex items-center gap-1"><Contact className="h-4 w-4" /> {player.tutorContact.phone}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
            <Button variant="outline">Editar Perfil</Button>
            <Button onClick={() => setEvalSheetOpen(true)}>
              <FilePlus className="mr-2 h-4 w-4" />
              Nueva Evaluación
            </Button>
        </div>
      </header>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            Análisis IA <Bot className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SummaryTab player={playerWithSchool} />
        </TabsContent>
        <TabsContent value="evaluations">
            {evalsLoading && <Skeleton className="h-40 w-full" />}
            {!evalsLoading && (!evaluations || evaluations.length === 0) ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <h3 className="font-semibold">Sin Evaluaciones</h3>
                  <p className="text-muted-foreground mt-2">
                    Aún no se han registrado evaluaciones para este jugador.
                  </p>
                  <Button className="mt-4" onClick={() => setEvalSheetOpen(true)}>
                    <FilePlus className="mr-2 h-4 w-4" />
                    Crear primera evaluación
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {evaluations?.map((evaluation) => (
                  <AccordionItem value={evaluation.id} key={evaluation.id}>
                    <AccordionTrigger>
                      <div className="flex justify-between w-full pr-4">
                        <span className="font-semibold">Evaluación del {format(evaluation.date, "PPP", { locale: es })}</span>
                        <span className="text-sm text-muted-foreground">Ver detalles</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <EvaluationDetailDisplay evaluation={evaluation} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab player={playerWithSchool} evaluations={evaluations || []} />
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
