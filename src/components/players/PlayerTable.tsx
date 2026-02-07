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
import { calculateAge } from "@/lib/utils";
import { useCollection, useUserProfile } from "@/firebase";
import { Skeleton } from "../ui/skeleton";
import React, { useMemo } from "react";

export function PlayerTable() {
  const router = useRouter();
  const { profile, isReady, isAdmin, isCoach } = useUserProfile();

  const collectionOptions = useMemo(() => {
    if (!isReady) return null;

    if (isAdmin) {
      return { orderBy: ['createdAt', 'desc'] as const };
    }
    if (isCoach && profile?.clubId) {
      return {
        where: ['clubId', '==', profile.clubId] as const,
        orderBy: ['createdAt', 'desc'] as const,
      };
    }
    return null; // Don't fetch if not ready or no permission
  }, [isReady, isAdmin, isCoach, profile?.clubId]);

  const { data: players, loading, error } = useCollection<Player>(
    collectionOptions ? 'players' : '',
    collectionOptions ?? undefined
  );


  if (!isReady || loading) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Posición</TableHead>
                        <TableHead>Edad</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-8 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20" /></TableCell>
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
    return <div className="text-destructive p-4">Error al cargar los jugadores: {error.message}</div>
  }
  
  if (!players || players.length === 0) {
      return <div className="text-center text-muted-foreground p-4">No hay jugadores para mostrar.</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Posición</TableHead>
            <TableHead>Edad</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow
              key={player.id}
              className="cursor-pointer"
              onClick={() => router.push(`/dashboard/players/${player.id}`)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={player.avatarUrl} alt={player.firstName} data-ai-hint="person portrait" />
                    <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <span>{player.firstName} {player.lastName}</span>
                </div>
              </TableCell>
              <TableCell>{player.category}</TableCell>
              <TableCell>{player.primaryPosition}</TableCell>
              <TableCell>{calculateAge(player.birthDate)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    player.status === "activo"
                      ? "secondary"
                      : player.status === "lesionado"
                      ? "destructive"
                      : "outline"
                  }
                  className={`capitalize ${player.status === "activo" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""}`}
                >
                  {player.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
