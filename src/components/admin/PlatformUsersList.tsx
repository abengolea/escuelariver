"use client";

import { useState } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Loader2, Shield, ShieldOff } from "lucide-react";
import { useCollection, useFirestore, useUserProfile } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { PlatformUser } from "@/lib/types";
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

export function PlatformUsersList() {
    const { data: platformUsers, loading: usersLoading } = useCollection<PlatformUser>('platformUsers', { orderBy: ['createdAt', 'desc'] });
    const { user: currentUser } = useUserProfile();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [actionToConfirm, setActionToConfirm] = useState<UserAction | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateRole = async () => {
        if (!actionToConfirm) return;
        setIsUpdating(true);
        const { user, action } = actionToConfirm;
        const newStatus = action === 'promote';
        const userRef = doc(firestore, 'platformUsers', user.id);

        try {
            await updateDoc(userRef, { super_admin: newStatus });
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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Fecha de Registro</TableHead>
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
                    {platformUsers?.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                                {user.super_admin ? (
                                    <Badge variant="default" className="bg-primary/80 hover:bg-primary">
                                        <Shield className="mr-2 h-3 w-3" />
                                        Super Admin
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">Usuario</Badge>
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
                    ))}
                </TableBody>
            </Table>
            {(!isLoading && !platformUsers?.length) && (
                <p className="text-center text-muted-foreground py-8">No hay usuarios en la plataforma.</p>
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
