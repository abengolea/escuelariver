"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import { Input } from "@/components/ui/input";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn, getMissingProfileFieldLabels } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useUser } from "@/firebase";
import { PlayerPhotoField } from "./PlayerPhotoField";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Player } from "@/lib/types";

const playerSchema = z.object({
  // Datos personales
  firstName: z.string().min(1, "El nombre es requerido."),
  lastName: z.string().min(1, "El apellido es requerido."),
  birthDate: z.date({ required_error: "La fecha de nacimiento es requerida." }),
  dni: z.string().optional(),
  healthInsurance: z.string().optional(),
  email: z.string().email("Debe ser un email válido.").optional().or(z.literal("")),
  tutorName: z.string().min(1, "El nombre del tutor es requerido."),
  tutorPhone: z.string().min(1, "El teléfono del tutor es requerido."),
  status: z.enum(["active", "inactive", "suspended"]),
  observations: z.string().optional(),
  photoUrl: z.string().url("Debe ser una URL válida.").optional().or(z.literal("")),
  // Datos físicos y deportivos
  altura_cm: z.union([z.number().min(80, "Mín. 80 cm").max(220, "Máx. 220 cm"), z.undefined()]).optional(),
  peso_kg: z.union([z.number().min(15, "Mín. 15 kg").max(150, "Máx. 150 kg"), z.undefined()]).optional(),
  pie_dominante: z.enum(["derecho", "izquierdo", "ambidiestro"]).optional(),
  posicion_preferida: z.enum(["delantero", "mediocampo", "defensor", "arquero"]).optional(),
});

interface EditPlayerDialogProps {
  player: Player;
  schoolId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Si es true, el jugador edita su propio perfil: no puede cambiar el campo Estado. */
  isPlayerEditing?: boolean;
}

export function EditPlayerDialog({
  player,
  schoolId,
  isOpen,
  onOpenChange,
  onSuccess,
  isPlayerEditing = false,
}: EditPlayerDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const birthDate = player.birthDate instanceof Date
    ? player.birthDate
    : player.birthDate
    ? new Date(player.birthDate as unknown as string | number)
    : new Date();

  const form = useForm<z.infer<typeof playerSchema>>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      firstName: player.firstName ?? "",
      lastName: player.lastName ?? "",
      birthDate,
      dni: player.dni ?? "",
      healthInsurance: player.healthInsurance ?? "",
      email: player.email ?? "",
      tutorName: player.tutorContact?.name ?? "",
      tutorPhone: player.tutorContact?.phone ?? "",
      status: player.status ?? "active",
      observations: player.observations ?? "",
      photoUrl: player.photoUrl ?? "",
      altura_cm: player.altura_cm ?? undefined,
      peso_kg: player.peso_kg ?? undefined,
      pie_dominante: player.pie_dominante ?? undefined,
      posicion_preferida: player.posicion_preferida ?? undefined,
    },
  });

  // Reset form when player changes or dialog opens
  useEffect(() => {
    if (isOpen && player) {
      const bd = player.birthDate instanceof Date
        ? player.birthDate
        : player.birthDate
        ? new Date(player.birthDate as unknown as string | number)
        : new Date();
      form.reset({
        firstName: player.firstName ?? "",
        lastName: player.lastName ?? "",
        birthDate: bd,
        dni: player.dni ?? "",
        healthInsurance: player.healthInsurance ?? "",
        email: player.email ?? "",
        tutorName: player.tutorContact?.name ?? "",
        tutorPhone: player.tutorContact?.phone ?? "",
        status: player.status ?? "active",
        observations: player.observations ?? "",
        photoUrl: player.photoUrl ?? "",
        altura_cm: player.altura_cm ?? undefined,
        peso_kg: player.peso_kg ?? undefined,
        pie_dominante: player.pie_dominante ?? undefined,
        posicion_preferida: player.posicion_preferida ?? undefined,
      });
    }
  }, [isOpen, player, form]);

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof playerSchema>) {
    const updateData = {
      firstName: values.firstName,
      lastName: values.lastName,
      birthDate: Timestamp.fromDate(values.birthDate),
      dni: values.dni || null,
      healthInsurance: values.healthInsurance || null,
      email: values.email?.trim() ? values.email.trim().toLowerCase() : null,
      tutorContact: {
        name: values.tutorName,
        phone: values.tutorPhone,
      },
      status: values.status,
      photoUrl: values.photoUrl || null,
      observations: values.observations || null,
      altura_cm: values.altura_cm ?? null,
      peso_kg: values.peso_kg ?? null,
      pie_dominante: values.pie_dominante ?? null,
      posicion_preferida: values.posicion_preferida ?? null,
    };

    const showSuccess = () => {
      onOpenChange(false);
      onSuccess?.();
      if (isPlayerEditing) {
        const missing = getMissingProfileFieldLabels({
          firstName: values.firstName,
          lastName: values.lastName,
          birthDate: values.birthDate,
          tutorName: values.tutorName,
          tutorPhone: values.tutorPhone,
          email: values.email,
          photoUrl: values.photoUrl,
        });
        if (missing.length > 0) {
          toast({
            title: "Guardado correctamente",
            description: `Se guardaron tus datos. Para desbloquear evaluaciones y videos completá: ${missing.join(", ")}.`,
          });
        } else {
          toast({
            title: "Perfil completo",
            description: "Todos los datos están guardados. Ya podés acceder a evaluaciones, videos y más.",
          });
        }
      } else {
        toast({
          title: "Guardado correctamente",
          description: `Los datos de ${values.firstName} ${values.lastName} se guardaron correctamente.`,
        });
      }
    };

    // Siempre usar la API para actualizar (evita errores de permisos en reglas del cliente).
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo verificar tu sesión. Volvé a iniciar sesión.",
      });
      return;
    }

    try {
      const token = await user.getIdToken();
      const birthDate = updateData.birthDate as Timestamp;
      const res = await fetch("/api/players/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolId,
          playerId: player.id,
          oldEmail: player.email ?? null,
          updateData: {
            ...updateData,
            birthDate: { seconds: birthDate.seconds, nanoseconds: birthDate.nanoseconds },
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "Error al guardar");
      }
      showSuccess();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: err instanceof Error ? err.message : "No se pudieron guardar los cambios.",
      });
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) form.reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar perfil del jugador</DialogTitle>
          <DialogDescription>
            <strong>Datos personales:</strong> nombre, apellido, fecha de nacimiento, DNI, tutor, teléfono, obra social, email, estado, foto, observaciones. <strong>Datos físicos:</strong> altura, peso, pie predominante, posición.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <Tabs defaultValue="personal" className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 mb-4 flex-shrink-0">
                <TabsTrigger value="personal">Datos personales</TabsTrigger>
                <TabsTrigger value="fisicos">Datos físicos</TabsTrigger>
              </TabsList>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2 -mr-2">
              <TabsContent value="personal" className="mt-0 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
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
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de Nacimiento</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
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
                  {!isPlayerEditing && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un estado" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            <SelectItem value="suspended">Suspendido por mora</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  )}
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foto del jugador</FormLabel>
                        <FormControl>
                          <PlayerPhotoField
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            schoolId={schoolId}
                            playerId={player.id}
                            playerName={`${player.firstName ?? ""} ${player.lastName ?? ""}`.trim()}
                          />
                        </FormControl>
                        <FormDescription>
                          Sacá una foto con la cámara o subí una imagen. Es necesario para que el jugador pueda ver su perfil completo.
                        </FormDescription>
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
              </TabsContent>
              <TabsContent value="fisicos" className="mt-0 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="altura_cm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altura (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={80}
                            max={220}
                            placeholder="Ej: 165"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>En centímetros. Rango típico 80–220 cm.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="peso_kg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (kg)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={15}
                            max={150}
                            step="0.1"
                            placeholder="Ej: 55"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>En kilogramos. Rango típico 15–150 kg.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pie_dominante"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pie predominante</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                          value={field.value ?? "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Opcional" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No especificado</SelectItem>
                            <SelectItem value="derecho">Derecho</SelectItem>
                            <SelectItem value="izquierdo">Izquierdo</SelectItem>
                            <SelectItem value="ambidiestro">Ambidiestro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Lateralidad del jugador.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="posicion_preferida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posición preferida</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                          value={field.value ?? "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Opcional" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No especificado</SelectItem>
                            <SelectItem value="delantero">Delantero</SelectItem>
                            <SelectItem value="mediocampo">Mediocampo</SelectItem>
                            <SelectItem value="defensor">Defensor</SelectItem>
                            <SelectItem value="arquero">Arquero</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </div>
            </Tabs>

            <DialogFooter className="pt-6 mt-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
