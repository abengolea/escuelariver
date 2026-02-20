"use client";

import { useState } from "react";
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
import { es } from "date-fns/locale";
import { useAuth, useFirestore, useStorage, useUserProfile } from "@/firebase";
import { collection, doc, writeBatch, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirebaseConfig } from "@/firebase/config";
import { PlayerPhotoField } from "./PlayerPhotoField";
import { uploadPlayerPhoto } from "@/lib/player-photo";
import { updateDoc } from "firebase/firestore";

function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const playerSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido."),
  lastName: z.string().min(1, "El apellido es requerido."),
  birthDate: z.date({ required_error: "La fecha de nacimiento es requerida." }),
  dni: z.string().optional(),
  healthInsurance: z.string().optional(),
  email: z.string().email("Debe ser un email válido.").optional().or(z.literal("")),
  initialPassword: z
    .string()
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => v.length === 0 || v.length >= 6, "Mínimo 6 caracteres."),
  tutorName: z.string().min(1, "El nombre del tutor es requerido."),
  tutorPhone: z.string().min(1, "El teléfono del tutor es requerido."),
  status: z.enum(["active", "inactive"]),
  observations: z.string().optional(),
  photoUrl: z.string().optional().or(z.literal("")),
  genero: z.enum(["masculino", "femenino", "arquero"]).optional(),
});

export function AddPlayerForm() {
    const firestore = useFirestore();
    const storage = useStorage();
    const mainAuth = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const { profile, activeSchoolId } = useUserProfile();

    const form = useForm<z.infer<typeof playerSchema>>({
        resolver: zodResolver(playerSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            initialPassword: "",
            tutorName: "",
            tutorPhone: "",
            status: "active",
            photoUrl: "",
            observations: "",
            genero: undefined,
            dni: "",
            healthInsurance: "",
        },
    });

    const hasEmail = !!form.watch("email")?.trim();
    const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

    async function onSubmit(values: z.infer<typeof playerSchema>) {
        if (!profile || !activeSchoolId) {
            toast({
                variant: "destructive",
                title: "Error de Perfil",
                description: "Tu perfil de usuario no está asociado a una escuela. No puedes añadir jugadores.",
            });
            return;
        }

        const emailNorm = values.email?.trim().toLowerCase();
        const wantsLogin = !!emailNorm;
        const adminSetsPassword = wantsLogin && !!values.initialPassword?.trim();
        const sendSetPasswordEmail = wantsLogin && !adminSetsPassword;

        let authUserCreated = false;
        const tempAppName = `temp-player-creation-${Date.now()}`;
        const tempApp = initializeApp(getFirebaseConfig(), tempAppName);
        const tempAuth = getAuth(tempApp);

        try {
            if (wantsLogin) {
                const password = adminSetsPassword
                    ? values.initialPassword!.trim()
                    : generateRandomPassword();
                await createUserWithEmailAndPassword(tempAuth, emailNorm, password);
                authUserCreated = true;
            }

            const playerData = {
                firstName: values.firstName,
                lastName: values.lastName,
                birthDate: Timestamp.fromDate(values.birthDate),
                dni: values.dni,
                healthInsurance: values.healthInsurance,
                ...(emailNorm && { email: emailNorm }),
                tutorContact: {
                    name: values.tutorName,
                    phone: values.tutorPhone,
                },
                status: values.status,
                photoUrl: values.photoUrl,
                observations: values.observations,
                ...(values.genero?.trim() && { genero: values.genero.trim() }),
                createdAt: Timestamp.now(),
                createdBy: profile.uid,
            };

            const playersCollectionRef = collection(firestore, `schools/${activeSchoolId}/players`);
            const newPlayerRef = doc(playersCollectionRef);
            const batch = writeBatch(firestore);
            batch.set(newPlayerRef, playerData);

            if (emailNorm) {
                batch.set(doc(firestore, "playerLogins", emailNorm), {
                    schoolId: activeSchoolId,
                    playerId: newPlayerRef.id,
                });
            }

            await batch.commit();

            if (pendingPhotoFile) {
                try {
                    const photoUrl = await uploadPlayerPhoto(storage, activeSchoolId, newPlayerRef.id, pendingPhotoFile);
                    await updateDoc(newPlayerRef, { photoUrl });
                } catch (photoErr) {
                    toast({
                        variant: "destructive",
                        title: "Jugador creado",
                        description: `Se creó el jugador pero no se pudo subir la foto: ${photoErr instanceof Error ? photoErr.message : "Error desconocido"}`,
                    });
                }
            }

            if (sendSetPasswordEmail) {
                try {
                    await sendPasswordResetEmail(mainAuth, emailNorm);
                    toast({
                        title: "Jugador añadido",
                        description: `Se creó la cuenta y se envió un correo a ${emailNorm} para que el jugador cree su contraseña.`,
                        duration: 8000,
                    });
                } catch (emailErr) {
                    toast({
                        title: "Jugador añadido",
                        variant: "destructive",
                        description: `Cuenta creada, pero no se pudo enviar el correo para crear contraseña. El jugador puede usar "¿Olvidaste tu contraseña?" en el login.`,
                        duration: 10000,
                    });
                }
            } else if (adminSetsPassword) {
                const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/login` : "";
                toast({
                    title: "Jugador añadido",
                    description: `Comunicale la contraseña al jugador por un canal seguro. Puede iniciar sesión en ${loginUrl}`,
                    duration: 10000,
                });
            } else {
                toast({
                    title: "Jugador añadido",
                    description: `${values.firstName} ${values.lastName} ha sido añadido a la base de datos.`,
                });
            }

            router.push("/dashboard/players");
        } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "auth/email-already-in-use") {
                toast({
                    variant: "destructive",
                    title: "Email en uso",
                    description: "Ese correo ya tiene una cuenta. Si debe acceder como jugador, usá otro email o que use «¿Olvidaste tu contraseña?» en el login.",
                    duration: 8000,
                });
                return;
            }
            if (code === "auth/weak-password") {
                toast({
                    variant: "destructive",
                    title: "Contraseña débil",
                    description: "La contraseña debe tener al menos 6 caracteres.",
                });
                return;
            }
            errorEmitter.emit(
                "permission-error",
                new FirestorePermissionError({
                    path: `schools/${activeSchoolId}/players`,
                    operation: "create",
                })
            );
            toast({
                variant: "destructive",
                title: "Error",
                description: authUserCreated
                    ? "No se pudo guardar el jugador. Revisá en Firebase Auth si se creó un usuario con ese email y eliminarlo si hace falta."
                    : "No se pudo añadir al jugador. Revisá permisos o intentá de nuevo.",
            });
        } finally {
            await deleteApp(tempApp);
        }
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
                        <FormDescription>Opcional. Si lo completas, podés crearle la cuenta para que entre al panel (con contraseña que vos definís o por correo para que la cree).</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                {hasEmail && (
                  <FormField
                    control={form.control}
                    name="initialPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña inicial (opcional)</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Mín. 6 caracteres" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormDescription>
                          Si la dejás en blanco, le enviaremos un correo al jugador para que cree su propia contraseña.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
                    name="genero"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Género / Categoría</FormLabel>
                        <Select
                            onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                            value={field.value ?? "__none__"}
                        >
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar (opcional)" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="__none__">No especificado</SelectItem>
                                <SelectItem value="masculino">Masculino</SelectItem>
                                <SelectItem value="femenino">Femenino</SelectItem>
                                <SelectItem value="arquero">Arquero</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormDescription>Masculino y femenino usan SUB-5 a SUB-18. Arquero entrena una vez por semana (sin género).</FormDescription>
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
                        <FormLabel>Foto del jugador (Opcional)</FormLabel>
                        <FormControl>
                        <PlayerPhotoField
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            schoolId={activeSchoolId ?? ""}
                            onFileChange={setPendingPhotoFile}
                            playerName={`${form.watch("firstName") ?? ""} ${form.watch("lastName") ?? ""}`.trim()}
                        />
                        </FormControl>
                        <FormDescription>Sacá una foto con la cámara o subí una imagen desde tu dispositivo.</FormDescription>
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
