"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Loader2, Shield, ShieldOff, Building2 } from "lucide-react";
import { useCollection, useFirestore, useUserProfile } from "@/firebase";
import { doc, updateDoc, collectionGroup, getDocs, collection } from "firebase/firestore";
import type { PlatformUser, School, SchoolUser } from "@/lib/types";
import { writeAuditLog } from "@/lib/audit";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type UserAction = {
    user: PlatformUser;
    action: 'promote' | 'demote';
}

type UserRoleInfo = {
    role: 'school_admin' | 'coach' | 'editor' | 'viewer' | 'player';
    displayName?: string;
    schoolId: string;
    playerId?: string;
};

type PlatformUsersListProps = {
    schools?: School[] | null;
};

export function PlatformUsersList({ schools = [] }: PlatformUsersListProps) {
    const { data: platformUsers, loading: usersLoading } = useCollection<PlatformUser>('platformUsers', { orderBy: ['createdAt', 'desc'] });
    const { user: currentUser } = useUserProfile();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [actionToConfirm, setActionToConfirm] = useState<UserAction | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");

    // Cuando hay un filtro por escuela, cargamos los usuarios de esa escuela (staff: admin, coach) con role y displayName
    const schoolUsersPath = selectedSchoolId && selectedSchoolId !== "all" ? `schools/${selectedSchoolId}/users` : "";
    const { data: schoolUsers } = useCollection<SchoolUser & { id: string }>(schoolUsersPath);

    // Para vista "Todas las escuelas": cargar roles desde collectionGroup + playerLogins
    const [allRolesMap, setAllRolesMap] = useState<Map<string, UserRoleInfo>>(new Map());
    const [playerMap, setPlayerMap] = useState<Map<string, { schoolId: string; playerId: string }>>(new Map());

    useEffect(() => {
        if (selectedSchoolId !== "all") return;
        const load = async () => {
            const rolesMap = new Map<string, UserRoleInfo>();
            const pMap = new Map<string, { schoolId: string; playerId: string }>();
            try {
                const [usersSnap, loginsSnap] = await Promise.all([
                    getDocs(collectionGroup(firestore!, "users")),
                    getDocs(collection(firestore!, "playerLogins")),
                ]);
                usersSnap.docs.forEach((d) => {
                    const schoolId = d.ref.parent.parent?.id;
                    if (!schoolId) return;
                    const data = d.data() as SchoolUser;
                    rolesMap.set(d.id, {
                        role: data.role,
                        displayName: data.displayName,
                        schoolId,
                        playerId: (data as { playerId?: string }).playerId,
                    });
                });
                loginsSnap.docs.forEach((d) => {
                    const data = d.data() as { schoolId: string; playerId: string };
                    if (data.schoolId && data.playerId) pMap.set(d.id, { schoolId: data.schoolId, playerId: data.playerId });
                });
                setAllRolesMap(rolesMap);
                setPlayerMap(pMap);
            } catch {
                setAllRolesMap(new Map());
                setPlayerMap(new Map());
            }
        };
        load();
    }, [selectedSchoolId, firestore]);

    const roleMap = useMemo(() => {
        if (selectedSchoolId === "all") return allRolesMap;
        const m = new Map<string, UserRoleInfo>();
        schoolUsers?.forEach((u) => {
            m.set(u.id, {
                role: u.role,
                displayName: u.displayName,
                schoolId: selectedSchoolId,
            });
        });
        return m;
    }, [selectedSchoolId, schoolUsers, allRolesMap]);

    const filteredUsers = useMemo(() => {
        if (!platformUsers) return [];
        if (selectedSchoolId === "all") return platformUsers;
        if (!schoolUsers) return [];
        const schoolUserIds = new Set(schoolUsers.map((u) => u.id));
        return platformUsers.filter(
            (u) => schoolUserIds.has(u.id) || u.super_admin
        );
    }, [platformUsers, selectedSchoolId, schoolUsers]);

    const handleUpdateRole = async () => {
        if (!actionToConfirm) return;
        setIsUpdating(true);
        const { user, action } = actionToConfirm;
        const newStatus = action === 'promote';
        const userRef = doc(firestore, 'platformUsers', user.id);

        try {
            await updateDoc(userRef, { super_admin: newStatus });
            if (currentUser?.uid && currentUser?.email) {
              await writeAuditLog(firestore, currentUser.email, currentUser.uid, {
                action: newStatus ? "platform_user.promote_super_admin" : "platform_user.demote_super_admin",
                resourceType: "platformUser",
                resourceId: user.id,
                details: user.email,
              });
            }
            toast({
                title: "Rol actualizado",
                description: `${user.email} ha sido ${newStatus ? 'promovido a' : 'revocado como'} Super Admin.`,
            });
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo cambiar el rol del usuario.",
            });
        } finally {
            setIsUpdating(false);
            setActionToConfirm(null);
        }
    };

    const isLoading = usersLoading;

    return (
        <>
        <div className="flex flex-col gap-4 pb-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                    <SelectTrigger className="w-full max-w-[280px] min-w-0">
                        <SelectValue placeholder="Filtrar por escuela" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las escuelas</SelectItem>
                        {schools?.map((school) => (
                            <SelectItem key={school.id} value={school.id}>
                                {school.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
        <Table className="min-w-[480px]">
            <TableHeader>
                <TableRow>
                    <TableHead className="text-xs sm:text-sm">Nombre / Email</TableHead>
                    <TableHead className="text-xs sm:text-sm">Rol</TableHead>
                    <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha de Registro</TableHead>
                    <TableHead className="text-right w-[80px]">Acciones</TableHead>
                </TableRow>
            </TableHeader>
                <TableBody>
                    {isLoading && [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                    {filteredUsers?.map((user) => {
                        const info = roleMap.get(user.id);
                        const href = info
                          ? info.playerId
                            ? `/dashboard/players/${info.playerId}?schoolId=${info.schoolId}`
                            : `/dashboard/schools/${info.schoolId}`
                          : null;
                        const displayName = info?.displayName ?? user.email;
                        const roleLabel =
                          info?.role === "school_admin"
                            ? "Admin"
                            : info?.role === "coach"
                              ? "Entrenador"
                              : info?.role === "player"
                                ? "Jugador"
                                : "Usuario";
                        return (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">
                                {href ? (
                                    <Link
                                        href={href}
                                        className="text-primary hover:underline focus:underline"
                                    >
                                        {displayName}
                                    </Link>
                                ) : (
                                    <span>{displayName}</span>
                                )}
                                {displayName !== user.email && (
                                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {user.super_admin ? (
                                    <Badge variant="default" className="bg-primary/80 hover:bg-primary">
                                        <Shield className="mr-2 h-3 w-3" />
                                        Super Admin
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">{roleLabel}</Badge>
                                )}
                            </TableCell>
                            <TableCell>{format(user.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                            <TableCell className="text-right">
                               <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating || user.id === currentUser?.uid}>
                                            <span className="sr-only">Abrir menú</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Acciones de Rol</DropdownMenuLabel>
                                        {user.super_admin ? (
                                            <DropdownMenuItem
                                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                onSelect={() => setActionToConfirm({ user, action: 'demote' })}
                                            >
                                                <ShieldOff className="mr-2 h-4 w-4" />
                                                Revocar Super Admin
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem onSelect={() => setActionToConfirm({ user, action: 'promote' })}>
                                                <Shield className="mr-2 h-4 w-4" />
                                                Promover a Super Admin
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
            </Table>
            {(!isLoading && !filteredUsers?.length) && (
                <p className="text-center text-muted-foreground py-8">
                    {selectedSchoolId === "all" ? "No hay usuarios en la plataforma." : "No hay usuarios asignados a esta escuela."}
                </p>
            )}

            <AlertDialog open={!!actionToConfirm} onOpenChange={(open) => !open && setActionToConfirm(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {actionToConfirm?.action === 'promote'
                        ? `Vas a promover a ${actionToConfirm?.user.email} a Super Administrador. Tendrá acceso completo a toda la plataforma.`
                        : `Vas a revocar los privilegios de Super Administrador de ${actionToConfirm?.user.email}. Perderá el acceso completo a la plataforma.`
                      }
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUpdating}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleUpdateRole}
                      disabled={isUpdating}
                      className={actionToConfirm?.action === 'demote' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
                    >
                      {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (actionToConfirm?.action === 'promote' ? <Shield className="mr-2 h-4 w-4" /> : <ShieldOff className="mr-2 h-4 w-4" />)}
                      {isUpdating ? "Actualizando..." : (actionToConfirm?.action === 'promote' ? "Sí, promover" : "Sí, revocar")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
