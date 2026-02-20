"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Bell, LogOut, Cake, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth, useUser, useUserProfile, useCollection } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import Link from "next/link";
import { isBirthdayToday } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { isReady, activeSchoolId, profile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  // Solo staff (school_admin o coach) puede listar jugadores y pendingPlayers; nunca listar si es jugador.
  const isStaff = profile?.role === "school_admin" || profile?.role === "coach";
  const canListSchoolCollections = isReady && activeSchoolId && isStaff;
  const { data: players } = useCollection<Player>(
    canListSchoolCollections ? `schools/${activeSchoolId}/players` : "",
    { orderBy: ["lastName", "asc"] }
  );
  const { data: pendingPlayers } = useCollection(
    canListSchoolCollections ? `schools/${activeSchoolId}/pendingPlayers` : "",
    {}
  );
  const { data: accessRequests } = useCollection(
    canListSchoolCollections ? "accessRequests" : "",
    { where: ["status", "==", "pending"] }
  );
  const playersList = (players ?? []).filter((p) => !p.archived);
  const birthdaysToday = playersList.filter((p) => isBirthdayToday(p.birthDate));
  const birthdayCount = birthdaysToday.length;
  // Solo staff ve solicitudes pendientes; el jugador no debe verlas.
  const solicitudesCount = isStaff ? (pendingPlayers?.length ?? 0) + (accessRequests?.length ?? 0) : 0;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return playersList.filter(
      (p) =>
        (p.firstName ?? "").toLowerCase().includes(q) ||
        (p.lastName ?? "").toLowerCase().includes(q) ||
        `${(p.firstName ?? "")} ${(p.lastName ?? "")}`.toLowerCase().includes(q) ||
        `${(p.lastName ?? "")} ${(p.firstName ?? "")}`.toLowerCase().includes(q)
    );
  }, [playersList, searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlayer = (playerId: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    router.push(`/dashboard/players/${playerId}?schoolId=${activeSchoolId}`);
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/auth/login');
  };

  return (
    <header className="flex h-14 items-center gap-2 sm:gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 min-w-0">
       <div className="md:hidden shrink-0">
         <SidebarTrigger />
       </div>
      <div className="w-full flex-1 min-w-0" ref={searchRef}>
        {isStaff && activeSchoolId && (
          <div className="relative md:w-2/3 lg:w-1/3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar jugadores..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults.length > 0) {
                  e.preventDefault();
                  handleSelectPlayer(searchResults[0].id);
                }
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  setSearchQuery("");
                }
              }}
              className="w-full appearance-none bg-background pl-8 shadow-none"
              autoComplete="off"
            />
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border bg-popover text-popover-foreground shadow-md max-h-72 overflow-y-auto">
                {searchQuery.trim() ? (
                  searchResults.length > 0 ? (
                    <ul className="py-1">
                      {searchResults.slice(0, 10).map((player) => (
                        <li key={player.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                            onClick={() => handleSelectPlayer(player.id)}
                          >
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={player.photoUrl} alt="" />
                              <AvatarFallback className="text-xs">
                                {(player.firstName?.[0] ?? "") + (player.lastName?.[0] ?? "")}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {player.firstName} {player.lastName}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No se encontraron jugadores.</p>
                  )
                ) : (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Escribí para buscar por nombre o apellido.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="h-5 w-5" />
            {(birthdayCount > 0 || solicitudesCount > 0) && (
              <Badge
                variant="destructive"
                className="absolute -top-0.5 -right-0.5 h-5 min-w-5 rounded-full px-1 text-xs"
              >
                {birthdayCount + solicitudesCount > 99 ? "99+" : birthdayCount + solicitudesCount}
              </Badge>
            )}
            <span className="sr-only">Notificaciones y novedades</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Novedades
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {!activeSchoolId ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Selecciona una escuela para ver novedades.
            </p>
          ) : birthdayCount === 0 && solicitudesCount === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No hay novedades.
            </p>
          ) : (
            <>
              {solicitudesCount > 0 && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/registrations"
                    className="flex items-center gap-2 py-2"
                  >
                    <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong>{solicitudesCount}</strong> solicitud{solicitudesCount !== 1 ? "es" : ""} pendiente{solicitudesCount !== 1 ? "s" : ""}
                    </span>
                  </Link>
                </DropdownMenuItem>
              )}
              {birthdaysToday.map((player) => (
                <DropdownMenuItem key={player.id} asChild>
                  <Link
                    href={`/dashboard/players/${player.id}?schoolId=${activeSchoolId}`}
                    className="flex items-center gap-2 py-2"
                  >
                    <Cake className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>
                      ¡Hoy cumple años: <strong>{player.firstName} {player.lastName}</strong>!
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              {user?.photoURL ? (
                <AvatarImage src={user.photoURL} alt={user.displayName || "User"} />
              ) : null}
              <AvatarFallback>
                {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">Alternar menú de usuario</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user?.displayName || user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
             <Link href="/dashboard/settings">Ajustes</Link>
          </DropdownMenuItem>
          <DropdownMenuItem>Soporte</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar Sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
