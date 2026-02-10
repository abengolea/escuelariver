"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Player } from "@/lib/types";
import { useRouter } from "next/navigation";
import { calculateAge, getCategoryLabel } from "@/lib/utils";
import { useCollection, useUserProfile } from "@/firebase";
import { Skeleton } from "../ui/skeleton";
import React from "react";

export function PlayerTable({ schoolId: propSchoolId }: { schoolId?: string }) {
  const router = useRouter();
  const { isReady, activeSchoolId: userActiveSchoolId, profile } = useUserProfile();

  const schoolId = propSchoolId || userActiveSchoolId;
  const canListPlayers = profile?.role !== "player";

  const posicionLabel: Record<string, string> = {
    arquero: "Arquero",
    delantero: "Delantero",
    mediocampo: "Mediocampo",
    defensor: "Defensor",
  };

  const { data: players, loading, error } = useCollection<Player>(
    isReady && schoolId && canListPlayers ? `schools/${schoolId}/players` : '',
    { orderBy: ['lastName', 'asc'] }
  );


  if (!isReady || loading) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Edad</TableHead>
                        <TableHead>Posición</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
  }

  if (error) {
    return <div className="text-destructive p-4">Error al cargar los jugadores. Es posible que no tengas permisos para verlos.</div>
  }
  
  if (!players || players.length === 0) {
      return <div className="text-center text-muted-foreground p-4">No hay jugadores para mostrar en esta escuela.</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Edad</TableHead>
            <TableHead>Posición</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow
              key={player.id}
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/players/${player.id}?schoolId=${schoolId}`)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={player.photoUrl} alt={player.firstName} data-ai-hint="person portrait" />
                    <AvatarFallback>{(player.firstName?.[0] || '')}{(player.lastName?.[0] || '')}</AvatarFallback>
                  </Avatar>
                  <span>{player.firstName} {player.lastName}</span>
                </div>
              </TableCell>
              <TableCell>{player.birthDate ? calculateAge(player.birthDate) : '-'}</TableCell>
              <TableCell>{player.posicion_preferida ? posicionLabel[player.posicion_preferida] ?? player.posicion_preferida : '-'}</TableCell>
              <TableCell>{player.birthDate ? getCategoryLabel(player.birthDate instanceof Date ? player.birthDate : new Date(player.birthDate)) : '-'}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    player.status === "suspended"
                      ? "destructive"
                      : player.status === "active"
                      ? "secondary"
                      : "secondary"
                  }
                  className={`capitalize ${
                    player.status === "active"
                      ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400"
                      : player.status === "suspended"
                      ? "border-amber-600/50 bg-amber-500/10 text-amber-800 dark:text-amber-400"
                      : ""
                  }`}
                >
                  {player.status === "active"
                    ? "Activo"
                    : player.status === "suspended"
                    ? "Suspendido por mora"
                    : "Inactivo"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
