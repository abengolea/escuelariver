"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { PlayerTable } from "@/components/players/PlayerTable";
import Link from "next/link";
import { useUserProfile } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayersPage() {
  const router = useRouter();
  const { profile, isReady, activeSchoolId } = useUserProfile();
  const playerId = profile?.playerId;

  useEffect(() => {
    if (!isReady) return;
    if (profile?.role === "player" && activeSchoolId && playerId) {
      router.replace(`/dashboard/players/${playerId}?schoolId=${activeSchoolId}`);
    }
  }, [isReady, profile?.role, activeSchoolId, playerId, router]);

  if (isReady && profile?.role === "player") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Skeleton className="h-10 w-1/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-headline sm:text-3xl">Jugadores</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/players/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Jugador
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg sm:text-xl">Plantel de Jugadores</CardTitle>
          <CardDescription className="text-sm">Gestiona los jugadores de tu escuela y mira sus perfiles.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <PlayerTable />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
