"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { Building, MoreHorizontal, Power, PowerOff, Loader2, Users, ShieldCheck, Edit } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { School, PlatformUser } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { Badge } from "../ui/badge";
import { CreateSchoolDialog } from "./CreateSchoolDialog";
import { useToast } from "@/hooks/use-toast";
import { EditSchoolDialog } from "./EditSchoolDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformUsersList } from "./PlatformUsersList";

export function SuperAdminDashboard() {
    const { data: schools, loading: schoolsLoading } = useCollection<School>('schools', { orderBy: ['createdAt', 'desc']});
    const { data: platformUsers, loading: usersLoading } = useCollection<PlatformUser>('platformUsers');
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [updatingSchoolId, setUpdatingSchoolId] = useState<string | null>(null);

    const isLoading = schoolsLoading || usersLoading;

    const handleStatusChange = async (schoolId: string, currentStatus: 'active' | 'suspended') => {
        setUpdatingSchoolId(schoolId);
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        const schoolRef = doc(firestore, 'schools', schoolId);

        try {
            await updateDoc(schoolRef, { status: newStatus });
            toast({
                title: "Estado actualizado",
                description: `La escuela ha sido ${newStatus === 'active' ? 'activada' : 'suspendida'}.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al actualizar",
                description: "No se pudo cambiar el estado de la escuela.",
            });
        } finally {
            setUpdatingSchoolId(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Panel de Super Administrador</h1>
                    <p className="text-muted-foreground">Gestiona todas las escuelas y usuarios de la plataforma.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <CreateSchoolDialog />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Escuelas Totales</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{schools?.length || 0}</div>}
                        <div className="text-xs text-muted-foreground">
                            {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `${schools?.filter(s => s.status === 'active').length || 0} activas`}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Registrados</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{platformUsers?.length || 0}</div>}
                        <div className="text-xs text-muted-foreground">
                             {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `En toda la plataforma`}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-2xl font-bold">{platformUsers?.filter(u => u.super_admin).length || 0}</div>}
                         <div className="text-xs text-muted-foreground">
                            {isLoading ? <Skeleton className="h-4 w-1/2 mt-1" /> : `Con acceso total al sistema`}
                        </div>
                    </CardContent>
                </Card>
            </div>

             <Tabs defaultValue="schools" className="w-full">
                <TabsList className="w-full grid grid-cols-2 gap-1 p-1 h-auto md:h-10 bg-card">
                    <TabsTrigger value="schools" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <Building className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Escuelas</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="text-xs px-2 py-2 gap-1 md:text-sm md:px-3 md:py-1.5 md:gap-2">
                        <Users className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
                        <span className="truncate">Usuarios</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="schools">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                                <Building className="h-5 w-5" />
                                Listado de Escuelas
                            </CardTitle>
                            <CardDescription>
                                {schoolsLoading ? 'Cargando listado de escuelas...' : `Haz click en una para gestionarla.`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-b-lg sm:rounded-none border-t sm:border-t-0">
                                <Table className="min-w-[560px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs sm:text-sm">Nombre de la Escuela</TableHead>
                                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Ubicación</TableHead>
                                            <TableHead className="text-xs sm:text-sm">Estado</TableHead>
                                            <TableHead className="text-xs sm:text-sm whitespace-nowrap">Fecha de Creación</TableHead>
                                            <TableHead className="text-right w-[80px]">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                <TableBody>
                                    {schoolsLoading && [...Array(3)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))}
                                    {schools?.map((school) => (
                                        <TableRow key={school.id} className="cursor-pointer hover:bg-muted" onClick={() => router.push(`/dashboard/schools/${school.id}`)}>
                                            <TableCell className="font-medium">
                                                {school.name}
                                            </TableCell>
                                            <TableCell>{school.city}, {school.province}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={school.status === 'active' ? 'secondary' : 'destructive'}
                                                    className={`capitalize ${school.status === "active" ? "border-green-600/50 bg-green-500/10 text-green-700 dark:text-green-400" : ""}`}
                                                >
                                                    {school.status === 'active' ? 'Activa' : 'Suspendida'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{format(school.createdAt, 'dd/MM/yyyy', { locale: es })}</TableCell>
                                            <TableCell className="text-right">
                                            <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} disabled={updatingSchoolId === school.id}>
                                                            <span className="sr-only">Abrir menú</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <EditSchoolDialog school={school}>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                <span>Editar Datos</span>
                                                            </DropdownMenuItem>
                                                        </EditSchoolDialog>
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                handleStatusChange(school.id, school.status);
                                                            }}
                                                            disabled={updatingSchoolId === school.id}
                                                        >
                                                            {updatingSchoolId === school.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : school.status === 'active' ? (
                                                                <PowerOff className="mr-2 h-4 w-4" />
                                                            ) : (
                                                                <Power className="mr-2 h-4 w-4" />
                                                            )}
                                                            <span>{updatingSchoolId === school.id ? 'Actualizando...' : school.status === 'active' ? 'Suspender' : 'Activar'}</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            {(!schoolsLoading && !schools?.length) && (
                                <p className="text-center text-muted-foreground py-8">No hay escuelas para mostrar.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="users">
                   <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Gestión de Usuarios Globales
                            </CardTitle>
                            <CardDescription>
                                {usersLoading ? 'Cargando usuarios...' : 'Gestiona los roles de todos los usuarios de la plataforma.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 rounded-b-lg sm:rounded-none border-t sm:border-t-0">
                                <PlatformUsersList />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
