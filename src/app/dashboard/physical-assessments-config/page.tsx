"use client";

import { useState } from "react";
import { useUserProfile, useDoc } from "@/firebase";
import type { PhysicalAssessmentConfig, PhysicalAssessmentTemplate } from "@/lib/types";
import {
  AGE_GROUPS,
  FIELDS_BY_AGE_GROUP,
  getFieldsForAgeGroup,
  type FieldDef,
} from "@/lib/physical-assessments";
import type { PhysicalAgeGroup } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import {
  Loader2,
  Activity,
  Zap,
  Dumbbell,
  Heart,
  Move,
  Target,
  FileText,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { AddOrEditTestDialog } from "@/components/physical-assessments/AddOrEditTestDialog";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  velocidad: Zap,
  fuerza: Dumbbell,
  resistencia: Heart,
  coordinacion: Move,
  agilidad: Target,
  observacion: FileText,
  flexibilidad: Target,
};

const TEMPLATE_DOC_ID = "physicalAssessmentTemplate";

export default function PhysicalAssessmentsConfigPage() {
  const { profile, isReady: profileReady, activeSchoolId } = useUserProfile();
  const schoolId = activeSchoolId ?? "";
  const { data: config, loading: configLoading } = useDoc<PhysicalAssessmentConfig>(
    schoolId ? `schools/${schoolId}/physicalAssessmentConfig/default` : ""
  );
  const { data: globalTemplate } = useDoc<PhysicalAssessmentTemplate & { id: string }>(
    `platformConfig/${TEMPLATE_DOC_ID}`
  );
  const firestore = useFirestore();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAgeGroup, setDialogAgeGroup] = useState<PhysicalAgeGroup | null>(null);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ group: PhysicalAgeGroup; key: string } | null>(null);

  const isLoading = !profileReady || (schoolId && configLoading);

  if (!profileReady) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Evaluaciones Físicas</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Selecciona una escuela en el panel para configurar las evaluaciones físicas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enabledByGroup = config?.enabledFieldsByAgeGroup ?? {};
  const customByGroup = config?.customFieldsByAgeGroup ?? {};
  const overridesByGroup = config?.fieldOverridesByAgeGroup ?? {};
  const isCoachOrAdmin = profile?.role === "coach" || profile?.role === "school_admin";

  const toggleField = (ageGroup: PhysicalAgeGroup, fieldKey: string, enabled: boolean) => {
    if (fieldKey.startsWith("custom_")) return; // custom fields no se desactivan, se eliminan
    const current = enabledByGroup[ageGroup] ?? FIELDS_BY_AGE_GROUP[ageGroup].map((f: FieldDef) => f.key);
    let next: string[];
    if (enabled) {
      next = current.includes(fieldKey) ? current : [...current, fieldKey];
    } else {
      next = current.filter((k: string) => k !== fieldKey);
    }
    saveConfig({ enabledFieldsByAgeGroup: { ...enabledByGroup, [ageGroup]: next } });
  };

  const setAllForGroup = (ageGroup: PhysicalAgeGroup, enabled: boolean) => {
    const allKeys = FIELDS_BY_AGE_GROUP[ageGroup].map((f: FieldDef) => f.key);
    saveConfig({ enabledFieldsByAgeGroup: { ...enabledByGroup, [ageGroup]: enabled ? allKeys : [] } });
  };

  const openAddDialog = (group: PhysicalAgeGroup) => {
    setEditingField(null);
    setDialogAgeGroup(group);
    setDialogOpen(true);
  };

  const openEditDialog = (group: PhysicalAgeGroup, field: FieldDef) => {
    setEditingField(field);
    setDialogAgeGroup(group);
    setDialogOpen(true);
  };

  const handleSaveTest = (data: {
    key: string;
    label: string;
    unit?: string;
    type: "number" | "text";
    min?: number;
    max?: number;
    placeholder?: string;
    category?: "velocidad" | "fuerza" | "resistencia" | "coordinacion" | "agilidad" | "flexibilidad" | "observacion";
    isCustom: boolean;
  }) => {
    if (!dialogAgeGroup) return;
    const fieldDef: FieldDef = {
      key: data.key,
      label: data.label,
      unit: data.unit,
      type: data.type,
      min: data.min,
      max: data.max,
      placeholder: data.placeholder,
      category: data.category,
    };
    if (data.isCustom) {
      const currentCustom = customByGroup[dialogAgeGroup] ?? [];
      const existingIdx = currentCustom.findIndex((f) => f.key === data.key);
      let nextCustom: FieldDef[];
      if (existingIdx >= 0) {
        nextCustom = [...currentCustom];
        nextCustom[existingIdx] = fieldDef;
      } else {
        nextCustom = [...currentCustom, fieldDef];
      }
      saveConfig({ customFieldsByAgeGroup: { ...customByGroup, [dialogAgeGroup]: nextCustom } });
    } else {
      const currentOverrides = overridesByGroup[dialogAgeGroup] ?? {};
      saveConfig({
        fieldOverridesByAgeGroup: {
          ...overridesByGroup,
          [dialogAgeGroup]: {
            ...currentOverrides,
            [data.key]: {
              label: data.label,
              unit: data.unit,
              min: data.min,
              max: data.max,
              placeholder: data.placeholder,
            },
          },
        },
      });
    }
  };

  const handleDeleteCustomField = (group: PhysicalAgeGroup, key: string) => {
    const current = customByGroup[group] ?? [];
    const next = current.filter((f) => f.key !== key);
    const nextCustomByGroup = { ...customByGroup };
    if (next.length === 0) {
      delete nextCustomByGroup[group];
    } else {
      nextCustomByGroup[group] = next;
    }
    saveConfig({ customFieldsByAgeGroup: nextCustomByGroup });
    setDeleteConfirm(null);
  };

  const saveConfig = async (updates: {
    enabledFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, string[]>>;
    customFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, FieldDef[]>>;
    fieldOverridesByAgeGroup?: Partial<Record<PhysicalAgeGroup, Record<string, object>>>;
  }) => {
    if (!profile) return;
    try {
      const ref = doc(firestore, `schools/${schoolId}/physicalAssessmentConfig`, "default");
      await setDoc(
        ref,
        {
          enabledFieldsByAgeGroup: updates.enabledFieldsByAgeGroup ?? enabledByGroup,
          customFieldsByAgeGroup: updates.customFieldsByAgeGroup ?? customByGroup,
          fieldOverridesByAgeGroup: updates.fieldOverridesByAgeGroup ?? overridesByGroup,
          updatedAt: Timestamp.now(),
          updatedBy: profile.uid,
        },
        { merge: true }
      );
      toast({ title: "Configuración guardada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err instanceof Error ? err.message : "No se pudo guardar la configuración.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Activity className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">Evaluaciones Físicas</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configurar tests por edad</CardTitle>
          <CardDescription>
            Activa o desactiva los tests predefinidos, edita sus propiedades o agrega tests personalizados para cada
            grupo etario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-8">
              {AGE_GROUPS.map(({ group, label }) => {
                const fields = getFieldsForAgeGroup(
                  group,
                  config ?? undefined,
                  globalTemplate?.acceptedFieldsByAgeGroup ?? undefined
                );
                const enabledKeys = enabledByGroup[group];
                const baseFields = FIELDS_BY_AGE_GROUP[group];

                return (
                  <div key={group} className="space-y-4 border-b pb-6 last:border-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-lg font-semibold">{label}</h3>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllForGroup(group, true)}
                          disabled={!isCoachOrAdmin}
                        >
                          Activar todos
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllForGroup(group, false)}
                          disabled={!isCoachOrAdmin}
                        >
                          Desactivar todos
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openAddDialog(group)}
                          disabled={!isCoachOrAdmin}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Agregar test
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {fields.map((field) => {
                        const isCustom = field.key.startsWith("custom_");
                        const isEnabled =
                          isCustom ||
                          enabledKeys == null ||
                          enabledKeys.length === 0 ||
                          enabledKeys.includes(field.key);
                        const Icon = field.category ? CATEGORY_ICONS[field.category] : Activity;

                        return (
                          <div
                            key={field.key}
                            className="flex items-center justify-between rounded-lg border p-4 gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {Icon && <Icon className="h-5 w-5 text-muted-foreground shrink-0" />}
                              <div className="min-w-0">
                                <Label className="font-medium">{field.label}</Label>
                                {field.category && (
                                  <p className="text-xs text-muted-foreground capitalize">{field.category}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isCustom && (
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => toggleField(group, field.key, checked)}
                                  disabled={!isCoachOrAdmin}
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(group, field)}
                                disabled={!isCoachOrAdmin}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isCustom && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm({ group, key: field.key })}
                                  disabled={!isCoachOrAdmin}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {baseFields.length === 0 && (customByGroup[group]?.length ?? 0) === 0 && (
                      <p className="text-sm text-muted-foreground">No hay tests configurados. Agrega uno personalizado.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddOrEditTestDialog
        ageGroup={dialogAgeGroup ?? "5-8"}
        editingField={editingField}
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveTest}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este test personalizado?</AlertDialogTitle>
            <AlertDialogDescription>
              El test se quitará de este grupo etario. Los datos ya registrados en evaluaciones previas no se borrarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && handleDeleteCustomField(deleteConfirm.group, deleteConfirm.key)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
