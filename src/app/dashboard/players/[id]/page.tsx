"use client";

import { notFound, useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cake, User, Contact } from "lucide-react";
import { calculateAge } from "@/lib/utils";
import { useDoc, useUserProfile } from "@/firebase";
import type { Player } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTab } from "@/components/players/PlayerProfile/SummaryTab";

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { activeSchoolId, isReady } = useUserProfile();
  
  const { data: player, loading } = useDoc<Player>(
      isReady && activeSchoolId ? `schools/${activeSchoolId}/players/${id}` : ''
  );

  if (loading || !isReady) {
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
            <Skeleton className="h-10 w-full max-w-sm rounded-md" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
  }

  if (!player) {
    notFound();
  }
  
  const playerWithSchool = { ...player, escuelaId: activeSchoolId! };

  return (
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
          <p className="text-xl text-muted-foreground">{player.categoryId}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
             <div className="flex items-center gap-1"><Cake className="h-4 w-4" /> {calculateAge(player.birthDate)} años</div>
             <div className="flex items-center gap-1"><User className="h-4 w-4" /> Tutor: {player.tutorContact.name}</div>
             <div className="flex items-center gap-1"><Contact className="h-4 w-4" /> {player.tutorContact.phone}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
            <Button>Editar Perfil</Button>
            <Button variant="outline">Generar Informe</Button>
        </div>
      </header>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-card">
          <TabsTrigger value="summary">Resumen</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <SummaryTab player={playerWithSchool} />
        </TabsContent>
        <TabsContent value="evaluations">
            <p className="p-4 text-center text-muted-foreground">La sección de evaluaciones está en construcción.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
