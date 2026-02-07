"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowUpRight, PlusCircle, Users, School } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCollection, useUserProfile, useDoc } from "@/firebase";
import type { Player, School as SchoolType } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

export default function DashboardPage() {
  const { profile, isReady, activeSchoolId } = useUserProfile();
  
  const { data: school, loading: schoolLoading } = useDoc<SchoolType>(
    activeSchoolId ? `schools/${activeSchoolId}` : ''
  );

  const { data: players, loading: playersLoading } = useCollection<Player>(
      activeSchoolId ? `schools/${activeSchoolId}/players` : '',
      { limit: 4 }
  );

  if (!isReady || schoolLoading || playersLoading) {
    return (
       <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between space-y-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Panel Principal</h1>
        </div>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Jugadores Totales</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-1/4" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sede</CardTitle>
                    <School className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     <Skeleton className="h-8 w-3/4" />
                </CardContent>
            </Card>
         </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Actividad Reciente</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground p-4">No hay actividad reciente para mostrar.</p>
                </CardContent>
            </Card>
             <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>Jugadores Recientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
          </div>
       </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Panel de {profile?.role === 'school_admin' ? 'Administración' : 'Entrenador'}</h1>
            <p className="text-muted-foreground">Bienvenido, {profile?.displayName}.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/players/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Jugador
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jugadores Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{players?.filter(p => p.status === 'active').length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {players ? `${players.length} en total` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sede Actual</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{school?.name || 'Sede no encontrada'}</div>
            <p className="text-xs text-muted-foreground">
              {school?.city || ''}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
              Resumen de evaluaciones y actualizaciones recientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <p className="text-sm text-muted-foreground p-4">Funcionalidad en construcción.</p>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Jugadores Añadidos Recientemente</CardTitle>
            <CardDescription>
              Últimos jugadores registrados en la escuela.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {players?.map((player) => (
                <div key={player.id} className="flex items-center">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={player.photoUrl} alt="Avatar" data-ai-hint="person portrait" />
                    <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{player.firstName} {player.lastName}</p>
                    <p className="text-sm text-muted-foreground">{player.categoryId}</p>
                  </div>
                  <Link href={`/dashboard/players/${player.id}`} className="ml-auto">
                    <Button variant="ghost" size="sm">
                       Ver <ArrowUpRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ))}
               {(!players || players.length === 0) && (
                 <p className="text-sm text-center text-muted-foreground p-4">No hay jugadores para mostrar.</p>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
