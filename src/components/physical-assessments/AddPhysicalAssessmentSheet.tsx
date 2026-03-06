"use client";

import React, { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useFirestore, useUserProfile, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, addDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import type { PhysicalAssessment, PhysicalAgeGroup, PhysicalAssessmentTemplate } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAgeGroup, FIELDS_BY_AGE_GROUP, getFieldsForAgeGroup, type PhysicalAssessmentConfigPartial } from "@/lib/physical-assessments";
import { useDoc } from "@/firebase";
import { getAgeInMonths, calculateIMC } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface AddPhysicalAssessmentSheetProps {
  playerId: string;
  schoolId: string;
  birthDate: Date;
  playerName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingAssessment?: PhysicalAssessment | null;
}

function buildSchema(fields: { key: string; type: string }[]) {
  const base = z.object({
    date: z.date({ required_error: "La fecha es requerida" }),
    altura_cm: z.number({ invalid_type_error: "Ingresa un número válido" }).min(80, "Mínimo 80 cm").max(220, "Máximo 220 cm"),
    peso_kg: z.number({ invalid_type_error: "Ingresa un número válido" }).min(15, "Mínimo 15 kg").max(150, "Máximo 150 kg"),
    observaciones_generales: z.string().optional(),
  });
  const extra: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === "number") {
      extra[f.key] = z.union([z.number(), z.undefined()]).optional();
    } else {
      extra[f.key] = z.string().optional();
    }
  }
  return base.extend(extra);
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

function getDefaultValues(fields: { key: string; type: string }[]): Partial<FormValues> {
  const values: Partial<FormValues> = {
    date: new Date(),
    altura_cm: undefined,
    peso_kg: undefined,
    observaciones_generales: "",
  };
  for (const f of fields) {
    if (f.type === "number") values[f.key as keyof FormValues] = undefined;
    else values[f.key as keyof FormValues] = "";
  }
  return values;
}

function getValuesFromAssessment(a: PhysicalAssessment): Partial<FormValues> {
  const values: Partial<FormValues> = {
    date: a.date instanceof Date ? a.date : new Date(a.date),
    altura_cm: a.altura_cm,
    peso_kg: a.peso_kg,
    observaciones_generales: a.observaciones_generales ?? "",
  };
  if (a.ageGroup && a.tests) {
    for (const [k, v] of Object.entries(a.tests)) {
      values[k as keyof FormValues] = v as number | string;
    }
  }
  return values;
}

export function AddPhysicalAssessmentSheet({
  playerId,
  schoolId,
  birthDate,
  playerName,
  isOpen,
  onOpenChange,
  editingAssessment = null,
}: AddPhysicalAssessmentSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { data: config } = useDoc<{
    id: string;
    enabledFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, string[]>>;
    customFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, Array<{ key: string; label: string; unit?: string; type: string; min?: number; max?: number; placeholder?: string; category?: string }>>>;
    fieldOverridesByAgeGroup?: Partial<Record<PhysicalAgeGroup, Record<string, object>>>;
  }>(
    schoolId ? `schools/${schoolId}/physicalAssessmentConfig/default` : ""
  );
  const { data: globalTemplate } = useDoc<PhysicalAssessmentTemplate & { id: string }>(
    "platformConfig/physicalAssessmentTemplate"
  );

  const ageGroup = useMemo(() => {
    if (editingAssessment) return editingAssessment.ageGroup;
    return getAgeGroup(birthDate);
  }, [birthDate, editingAssessment]);

  const fields = useMemo(() => {
    if (!ageGroup) return [];
    return getFieldsForAgeGroup(
      ageGroup,
      (config ?? undefined) as PhysicalAssessmentConfigPartial | undefined,
      globalTemplate?.acceptedFieldsByAgeGroup ?? undefined
    );
  }, [ageGroup, config, globalTemplate?.acceptedFieldsByAgeGroup]);

  const isEditMode = Boolean(editingAssessment?.id);
  const schema = useMemo(() => buildSchema(fields), [fields]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as z.ZodType<FormValues>),
    defaultValues: getDefaultValues(fields),
  });

  React.useEffect(() => {
    if (isOpen && editingAssessment) {
      form.reset(getValuesFromAssessment(editingAssessment));
    } else if (isOpen && !editingAssessment) {
      form.reset({ ...getDefaultValues(fields), date: new Date() });
    }
  }, [isOpen, editingAssessment?.id, fields]);

  function onSubmit(values: FormValues) {
    if (!profile) {
      toast({ variant: "destructive", title: "Error", description: "No tienes perfil de usuario." });
      return;
    }
    if (!ageGroup) {
      toast({ variant: "destructive", title: "Edad fuera de rango", description: "Las evaluaciones físicas están disponibles para jugadores entre 5 y 18 años." });
      return;
    }

    const fechaRef = values.date instanceof Date ? values.date : new Date(values.date);
    const edadEnMeses = getAgeInMonths(birthDate, fechaRef);
    const altura = values.altura_cm;
    const peso = values.peso_kg;
    const imc = calculateIMC(peso, altura);

    const tests: Record<string, number | string | undefined> = {};
    for (const f of fields) {
      const v = values[f.key as keyof FormValues];
      if (v !== undefined && v !== null && v !== "") {
        tests[f.key] = typeof v === "number" ? v : String(v);
      }
    }

    const payload = {
      playerId,
      date: isEditMode ? (editingAssessment!.date instanceof Date ? editingAssessment!.date : new Date(editingAssessment!.date)) : fechaRef,
      edad_en_meses: edadEnMeses,
      altura_cm: altura,
      peso_kg: peso,
      imc,
      observaciones_generales: values.observaciones_generales ?? undefined,
      tests,
      ageGroup,
    };

    // Al guardar/actualizar evaluación física, sincronizamos altura y peso en el perfil del jugador (el último dato borra el anterior)
    const updatePlayerPhysical = () =>
      updateDoc(doc(firestore, `schools/${schoolId}/players/${playerId}`), {
        altura_cm: altura ?? null,
        peso_kg: peso ?? null,
      });

    if (isEditMode && editingAssessment) {
      const docRef = doc(firestore, `schools/${schoolId}/physicalAssessments/${editingAssessment.id}`);
      updateDoc(docRef, payload)
        .then(() => updatePlayerPhysical())
        .then(() => {
          toast({ title: "Evaluación física actualizada" });
          onOpenChange(false);
        })
        .catch(() => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: docRef.path, operation: "update", requestResourceData: payload }));
          toast({ variant: "destructive", title: "Error de permisos" });
        });
      return;
    }

    const docData = {
      ...payload,
      date: Timestamp.fromDate(fechaRef),
      createdAt: Timestamp.now(),
      createdBy: profile.uid,
    };

    addDoc(collection(firestore, `schools/${schoolId}/physicalAssessments`), docData)
      .then(() => updatePlayerPhysical())
      .then(() => {
        toast({ title: "Evaluación física guardada" });
        form.reset();
        onOpenChange(false);
      })
      .catch(() => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({
          path: `schools/${schoolId}/physicalAssessments`,
          operation: "create",
          requestResourceData: docData,
        }));
        toast({ variant: "destructive", title: "Error de permisos" });
      });
  }

  if (!ageGroup && !editingAssessment) {
    return (
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Evaluación física</SheetTitle>
            <SheetDescription>
              Las evaluaciones físicas están disponibles para jugadores entre 5 y 18 años. {playerName ? `${playerName} está fuera de este rango.` : ""}
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-headline">
            {isEditMode ? "Editar Evaluación Física" : "Nueva Evaluación Física"}
          </SheetTitle>
          <SheetDescription>
            {ageGroup && `Grupo: ${ageGroup} años. Campos ajustados a la edad del jugador.`}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <Form {...form}>
            <form id="physical-assessment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP", { locale: es }) : "Seleccionar"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={es} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
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
                          placeholder="Ej: 150"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
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
                          placeholder="Ej: 45"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {fields.map((fieldDef) => (
                <FormField
                  key={fieldDef.key}
                  control={form.control}
                  name={fieldDef.key as keyof FormValues}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {fieldDef.label}
                        {fieldDef.unit && (
                          <span className="text-muted-foreground font-normal ml-1">({fieldDef.unit})</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        {fieldDef.type === "number" ? (
                          <Input
                            type="number"
                            step="0.01"
                            min={fieldDef.min}
                            max={fieldDef.max}
                            placeholder={fieldDef.placeholder}
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              field.onChange(v === "" ? undefined : Number(v));
                            }}
                          />
                        ) : (
                          <Textarea placeholder={fieldDef.placeholder} {...field} value={field.value ?? ""} />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

              <FormField
                control={form.control}
                name="observaciones_generales"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones generales</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notas adicionales..." {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>
        <SheetFooter className="pt-4 border-t">
          <SheetClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </SheetClose>
          <Button type="submit" form="physical-assessment-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.formState.isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Guardar Evaluación"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
