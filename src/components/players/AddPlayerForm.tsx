"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { useFirestore, useUserProfile } from "@/firebase";
import { collection, addDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


const playerSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido."),
  lastName: z.string().min(1, "El apellido es requerido."),
  birthDate: z.date({ required_error: "La fecha de nacimiento es requerida."}),
  dni: z.string().optional(),
  healthInsurance: z.string().optional(),
  email: z.string().email("Debe ser un email válido.").optional().or(z.literal('')),
  tutorName: z.string().min(1, "El nombre del tutor es requerido."),
  tutorPhone: z.string().min(1, "El teléfono del tutor es requerido."),
  status: z.enum(["active", "inactive"]),
  observations: z.string().optional(),
  photoUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal('')),
});

export function AddPlayerForm() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const { profile, activeSchoolId } = useUserProfile();

    const form = useForm<z.infer<typeof playerSchema>>({
        resolver: zodResolver(playerSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            tutorName: "",
            tutorPhone: "",
            status: "active",
            photoUrl: "",
            observations: "",
            dni: "",
            healthInsurance: "",
        },
    });

    function onSubmit(values: z.infer<typeof playerSchema>) {
        if (!profile || !activeSchoolId) {
            toast({
                variant: "destructive",
                title: "Error de Perfil",
                description: "Tu perfil de usuario no está asociado a una escuela. No puedes añadir jugadores.",
            });
            return;
        }

        const playerData = {
            firstName: values.firstName,
            lastName: values.lastName,
            birthDate: Timestamp.fromDate(values.birthDate),
            dni: values.dni,
            healthInsurance: values.healthInsurance,
            ...(values.email?.trim() && { email: values.email.trim().toLowerCase() }),
            tutorContact: {
                name: values.tutorName,
                phone: values.tutorPhone,
            },
            status: values.status,
            photoUrl: values.photoUrl,
            observations: values.observations,
            createdAt: Timestamp.now(),
            createdBy: profile.uid,
        };

        const playersCollectionRef = collection(firestore, `schools/${activeSchoolId}/players`);

        addDoc(playersCollectionRef, playerData)
            .then(async (newPlayerRef) => {
                const emailNorm = values.email?.trim().toLowerCase();
                if (emailNorm) {
                    const loginRef = doc(firestore, "playerLogins", emailNorm);
                    await setDoc(loginRef, { schoolId: activeSchoolId, playerId: newPlayerRef.id });
                }
                toast({
                    title: "Jugador añadido",
                    description: `${values.firstName} ${values.lastName} ha sido añadido a la base de datos.`,
                });
                router.push("/dashboard/players");
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: `schools/${activeSchoolId}/players`,
                    operation: 'create',
                    requestResourceData: playerData,
                });
                errorEmitter.emit('permission-error', permissionError);

                toast({
                    variant: "destructive",
                    title: "Error de permisos",
                    description: "No tienes permiso para añadir jugadores. Contacta a un administrador.",
                });
            });
    }

    return (
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                        <Input placeholder="Lionel" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                        <Input placeholder="Messi" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email (acceso al panel)</FormLabel>
                        <FormControl>
                        <Input type="email" placeholder="jugador@ejemplo.com" {...field} />
                        </FormControl>
                        <FormDescription>Opcional. Si lo completas, el jugador podrá iniciar sesión y ver su perfil.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Nacimiento</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP", { locale: es })
                                ) : (
                                    <span>Elige una fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                captionLayout="dropdown"
                                fromYear={2000}
                                toYear={new Date().getFullYear()}
                                locale={es}
                                disabled={(date) =>
                                date > new Date() || date < new Date("2000-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="dni"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>DNI (Opcional)</FormLabel>
                        <FormControl>
                        <Input placeholder="40.123.456" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="tutorName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre del Tutor</FormLabel>
                        <FormControl>
                        <Input placeholder="Jorge Messi" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="tutorPhone"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Teléfono del Tutor</FormLabel>
                        <FormControl>
                        <Input placeholder="+54 9 ..." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="healthInsurance"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Obra Social (Opcional)</FormLabel>
                        <FormControl>
                        <Input placeholder="Nombre de la obra social" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="active">Activo</SelectItem>
                                <SelectItem value="inactive">Inactivo</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>URL de Foto (Opcional)</FormLabel>
                        <FormControl>
                        <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormDescription>URL pública de la imagen del jugador.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Observaciones</FormLabel>
                        <FormControl>
                            <Input placeholder="Cualquier nota adicional..." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
            <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.formState.isSubmitting ? "Guardando..." : "Añadir Jugador"}
            </Button>
        </form>
        </Form>
    );
}
