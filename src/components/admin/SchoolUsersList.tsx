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
import { useCollection, useFirestore } from "@/firebase";
import type { SchoolUser } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Users, MoreHorizontal, Loader2, Edit } from "lucide-react";
import { AddSchoolUserDialog } from "./AddSchoolUserDialog";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "../ui/dropdown-menu";
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
import { doc, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/firebase";
import { EditSchoolUserDialog } from "./EditSchoolUserDialog";

export function SchoolUsersList({ schoolId }: { schoolId: string }) {
  const { data: users, loading: usersLoading } = useCollection<SchoolUser>(`schools/${schoolId}/users`, { orderBy: ['displayName', 'asc'] });
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUserProfile();

  const [userToDelete, setUserToDelete] = useState<SchoolUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const loading = usersLoading;

  const roleDisplay: { [key in SchoolUser['role']]: string } = {
    school_admin: 'Admin. de Escuela',
    coach: 'Entrenador'
  };

  const handleRevokeAccess = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    const userRef = doc(firestore, `schools/${schoolId}/users`, userToDelete.id);

    try {
      await deleteDoc(userRef);
      toast({
        title: "Acceso Revocado",
        description: `El usuario ${userToDelete.displayName} ya no tiene acceso a esta escuela.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo revocar el acceso. Es posible que no tengas permisos para esta acción.",
      });
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
              <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuarios de la Escuela
              </CardTitle>
              <CardDescription>
                  {loading ? 'Cargando usuarios...' : `Hay ${users?.length || 0} usuarios asignados a esta escuela.`}
              </CardDescription>
          </div>
          <AddSchoolUserDialog schoolId={schoolId} />
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-b-lg sm:rounded-none border-t sm:border-t-0">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Nombre</TableHead>
                  <TableHead className="text-xs sm:text-sm">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm">Rol</TableHead>
                  <TableHead className="text-right w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {loading && [...Array(2)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))}
              {!loading && users?.map((userRow) => (
                <TableRow key={userRow.id}>
                  <TableCell className="font-medium">{userRow.displayName}</TableCell>
                  <TableCell>{userRow.email}</TableCell>
                  <TableCell>
                      <Badge variant={userRow.role === 'school_admin' ? 'default' : 'secondary'}>{roleDisplay[userRow.role] || userRow.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" disabled={userRow.id === user?.uid}>
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <EditSchoolUserDialog schoolId={schoolId} user={userRow}>
                                    <DropdownMenuItem onSelect={e => e.preventDefault()}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Editar Usuario</span>
                                    </DropdownMenuItem>
                                </EditSchoolUserDialog>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onSelect={() => setUserToDelete(userRow)}
                                disabled={userRow.id === user?.uid}
                              >
                                Revocar Acceso
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                      </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && (!users || users.length === 0) && (
                  <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay usuarios asignados a esta escuela.</TableCell>
                  </TableRow>
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción revocará el acceso de <span className="font-semibold">{userToDelete?.displayName}</span> a la escuela. El usuario no será eliminado de la plataforma, pero no podrá acceder a los datos de esta sede. Puedes volver a darle acceso más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAccess}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? "Revocando..." : "Sí, revocar acceso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
