"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Check, Loader2, Zap, Dumbbell, Heart, Move, Target, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { useFirestore, useUserProfile, useDoc } from "@/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { writeAuditLog } from "@/lib/audit";
import type { School } from "@/lib/types";
import type { PhysicalAssessmentTemplate } from "@/lib/types";
import type { PhysicalAssessmentConfig } from "@/lib/types";
import type { PhysicalAgeGroup, PhysicalFieldDef } from "@/lib/types";
import {
  AGE_GROUPS,
  FIELDS_BY_AGE_GROUP,
  type FieldDef,
  type GlobalAcceptedFieldsByAgeGroup,
} from "@/lib/physical-assessments";
import { useToast } from "@/hooks/use-toast";
import { AddOrEditTestDialog } from "@/components/physical-assessments/AddOrEditTestDialog";
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

const TEMPLATE_DOC_ID = "physicalAssessmentTemplate";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  velocidad: Zap,
  fuerza: Dumbbell,
  resistencia: Heart,
  coordinacion: Move,
  agilidad: Target,
  observacion: FileText,
  flexibilidad: Target,
};

function fieldToDef(f: PhysicalFieldDef | FieldDef): FieldDef {
  return {
    key: f.key,
    label: f.label,
    unit: f.unit,
    type: f.type,
    min: f.min,
    max: f.max,
    placeholder: f.placeholder,
    category: f.category,
  };
}

function ensureUniqueKey(accepted: FieldDef[], key: string): string {
  const keys = new Set(accepted.map((x) => x.key));
  if (!keys.has(key)) return key;
  let i = 1;
  while (keys.has(`${key}_${i}`)) i++;
  return `${key}_${i}`;
}

interface SuperAdminPhysicalTemplateTabProps {
  schools: School[] | null;
}

export function SuperAdminPhysicalTemplateTab({ schools }: SuperAdminPhysicalTemplateTabProps) {
  const firestore = useFirestore();
  const { user } = useUserProfile();
  const { toast } = useToast();
  const { data: template, loading: templateLoading } = useDoc<PhysicalAssessmentTemplate & { id: string }>(
    `platformConfig/${TEMPLATE_DOC_ID}`
  );
  const [schoolConfigs, setSchoolConfigs] = useState<Record<string, PhysicalAssessmentConfig & { id: string }>>({});
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAgeGroup, setDialogAgeGroup] = useState<PhysicalAgeGroup | null>(null);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ageGroup: PhysicalAgeGroup; key: string } | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!schools?.length) {
      setSchoolConfigs({});
      return;
    }
    setLoadingConfigs(true);
    Promise.all(
      schools.map((s) =>
        getDoc(doc(firestore, `schools/${s.id}/physicalAssessmentConfig`, "default"))
      )
    )
      .then((snaps) => {
        const map: Record<string, PhysicalAssessmentConfig & { id: string }> = {};
        snaps.forEach((snap, i) => {
          const school = schools[i];
          if (school && snap.exists()) {
            const d = snap.data();
            map[school.id] = {
              id: snap.id,
              enabledFieldsByAgeGroup: d.enabledFieldsByAgeGroup ?? {},
              customFieldsByAgeGroup: d.customFieldsByAgeGroup,
              fieldOverridesByAgeGroup: d.fieldOverridesByAgeGroup,
              updatedAt: d.updatedAt?.toDate?.() ?? new Date(),
              updatedBy: d.updatedBy ?? "",
            };
          }
        });
        setSchoolConfigs(map);
      })
      .finally(() => setLoadingConfigs(false));
  }, [firestore, schools]);

  const acceptedByGroup = useMemo(
    () => template?.acceptedFieldsByAgeGroup ?? {},
    [template?.acceptedFieldsByAgeGroup]
  );

  const proposals = useMemo(() => {
    const list: { schoolId: string; schoolName: string; ageGroup: PhysicalAgeGroup; field: PhysicalFieldDef }[] = [];
    if (!schools?.length) return list;
    const acceptedKeysByGroup: Record<PhysicalAgeGroup, Set<string>> = {
      "5-8": new Set((acceptedByGroup["5-8"] ?? []).map((f) => f.key)),
      "9-12": new Set((acceptedByGroup["9-12"] ?? []).map((f) => f.key)),
      "13-15": new Set((acceptedByGroup["13-15"] ?? []).map((f) => f.key)),
      "16-18": new Set((acceptedByGroup["16-18"] ?? []).map((f) => f.key)),
    };
    const baseKeysByGroup = Object.fromEntries(
      (["5-8", "9-12", "13-15", "16-18"] as PhysicalAgeGroup[]).map((g) => [
        g,
        new Set(FIELDS_BY_AGE_GROUP[g].map((f) => f.key)),
      ])
    ) as Record<PhysicalAgeGroup, Set<string>>;

    schools.forEach((school) => {
      const config = schoolConfigs[school.id];
      const custom = config?.customFieldsByAgeGroup ?? {};
      (AGE_GROUPS.map((a) => a.group) as PhysicalAgeGroup[]).forEach((ageGroup) => {
        const fields = custom[ageGroup] ?? [];
        fields.forEach((field) => {
          const alreadyInBase = baseKeysByGroup[ageGroup]?.has(field.key);
          const alreadyAccepted = acceptedKeysByGroup[ageGroup]?.has(field.key);
          if (!alreadyInBase && !alreadyAccepted) {
            list.push({
              schoolId: school.id,
              schoolName: school.name,
              ageGroup,
              field: { ...field, key: field.key, label: field.label, type: field.type },
            });
          }
        });
      });
    });
    return list;
  }, [schools, schoolConfigs, acceptedByGroup]);

  const handleAccept = async (
    ageGroup: PhysicalAgeGroup,
    field: PhysicalFieldDef,
    schoolName: string
  ) => {
    if (!user?.uid || !user?.email) return;
    const compositeKey = `${ageGroup}:${field.key}:${schoolName}`;
    setAcceptingKey(compositeKey);
    try {
      const current = (acceptedByGroup[ageGroup] ?? []).map(fieldToDef);
      const newKey = ensureUniqueKey(current, field.key);
      const newField: FieldDef = {
        key: newKey,
        label: field.label,
        unit: field.unit,
        type: field.type,
        min: field.min,
        max: field.max,
        placeholder: field.placeholder,
        category: field.category,
      };
      const nextAccepted: GlobalAcceptedFieldsByAgeGroup = {
        ...acceptedByGroup,
        [ageGroup]: [...current, newField],
      };
      const ref = doc(firestore, "platformConfig", TEMPLATE_DOC_ID);
      await setDoc(
        ref,
        {
          acceptedFieldsByAgeGroup: nextAccepted,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid,
        },
        { merge: true }
      );
      await writeAuditLog(firestore, user.email, user.uid, {
        action: "physical_assessment_template.accept_field",
        resourceType: "physicalAssessmentTemplate",
        resourceId: TEMPLATE_DOC_ID,
        details: `ageGroup=${ageGroup}, key=${newKey}, label=${field.label}, school=${schoolName}`,
      });
      toast({
        title: "Añadido a la plantilla básica",
        description: `"${field.label}" ya está disponible para todas las escuelas.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo aceptar el test.",
      });
    } finally {
      setAcceptingKey(null);
    }
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

  const handleSaveTemplateField = async (data: {
    key: string;
    label: string;
    unit?: string;
    type: "number" | "text";
    min?: number;
    max?: number;
    placeholder?: string;
    category?: string;
    isCustom: boolean;
  }) => {
    if (!user?.uid || !user?.email || !dialogAgeGroup) return;
    setSavingTemplate(true);
    try {
      const current = (acceptedByGroup[dialogAgeGroup] ?? []).map(fieldToDef);
      const isEdit = editingField && current.some((f) => f.key === editingField.key);
      const newField: FieldDef = {
        key: isEdit ? editingField!.key : ensureUniqueKey(current, data.key),
        label: data.label,
        unit: data.unit,
        type: data.type,
        min: data.min,
        max: data.max,
        placeholder: data.placeholder,
        category: data.category as FieldDef["category"],
      };
      let nextList: FieldDef[];
      if (isEdit) {
        nextList = current.map((f) => (f.key === editingField!.key ? newField : f));
      } else {
        nextList = [...current, newField];
      }
      const nextAccepted: GlobalAcceptedFieldsByAgeGroup = {
        ...acceptedByGroup,
        [dialogAgeGroup]: nextList,
      };
      const ref = doc(firestore, "platformConfig", TEMPLATE_DOC_ID);
      await setDoc(
        ref,
        {
          acceptedFieldsByAgeGroup: nextAccepted,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid,
        },
        { merge: true }
      );
      await writeAuditLog(firestore, user.email, user.uid, {
        action: "physical_assessment_template.accept_field",
        resourceType: "physicalAssessmentTemplate",
        resourceId: TEMPLATE_DOC_ID,
        details: isEdit
          ? `edit ageGroup=${dialogAgeGroup}, key=${newField.key}`
          : `add ageGroup=${dialogAgeGroup}, key=${newField.key}, label=${newField.label}`,
      });
      toast({
        title: isEdit ? "Test actualizado" : "Test agregado a la plantilla",
        description: `"${newField.label}" quedó en la plantilla básica para todas las escuelas.`,
      });
      setDialogOpen(false);
      setEditingField(null);
      setDialogAgeGroup(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar.",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleRemoveFromTemplate = async (ageGroup: PhysicalAgeGroup, key: string) => {
    if (!user?.uid || !user?.email) return;
    setSavingTemplate(true);
    try {
      const current = (acceptedByGroup[ageGroup] ?? []).map(fieldToDef).filter((f) => f.key !== key);
      const nextAccepted: GlobalAcceptedFieldsByAgeGroup = {
        ...acceptedByGroup,
        [ageGroup]: current.length ? current : undefined,
      };
      if (nextAccepted[ageGroup]?.length === 0) delete nextAccepted[ageGroup];
      const ref = doc(firestore, "platformConfig", TEMPLATE_DOC_ID);
      await setDoc(
        ref,
        {
          acceptedFieldsByAgeGroup: nextAccepted,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid,
        },
        { merge: true }
      );
      await writeAuditLog(firestore, user.email, user.uid, {
        action: "physical_assessment_template.accept_field",
        resourceType: "physicalAssessmentTemplate",
        resourceId: TEMPLATE_DOC_ID,
        details: `remove ageGroup=${ageGroup}, key=${key}`,
      });
      toast({ title: "Test quitado de la plantilla", description: "Ya no forma parte de la plantilla básica." });
      setDeleteConfirm(null);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo quitar.",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const isLoading = templateLoading || loadingConfigs;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Plantilla básica de evaluaciones físicas
          </CardTitle>
          <CardDescription>
            Tests predefinidos y los aceptados desde propuestas de entrenadores. Una vez aceptados, quedan disponibles para todas las escuelas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="space-y-6">
              {(AGE_GROUPS as { group: PhysicalAgeGroup; label: string }[]).map(({ group, label }) => {
                const baseFields = FIELDS_BY_AGE_GROUP[group];
                const accepted = (acceptedByGroup[group] ?? []).map(fieldToDef);
                return (
                  <div key={group} className="space-y-3 border-b pb-6 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-muted-foreground">{label}</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openAddDialog(group)}
                        disabled={savingTemplate}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar test
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {baseFields.map((f) => {
                        const Icon = f.category ? CATEGORY_ICONS[f.category] : Activity;
                        return (
                          <Badge key={f.key} variant="secondary" className="gap-1">
                            {Icon && <Icon className="h-3 w-3" />}
                            {f.label}
                            {f.unit && ` (${f.unit})`}
                          </Badge>
                        );
                      })}
                    </div>
                    {accepted.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {accepted.map((f) => {
                          const Icon = f.category ? CATEGORY_ICONS[f.category] : Activity;
                          return (
                            <div
                              key={f.key}
                              className="flex items-center justify-between gap-2 rounded-lg border p-3 bg-muted/30"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                                <span className="font-medium truncate">{f.label}</span>
                                {f.unit && <span className="text-muted-foreground text-xs">({f.unit})</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(group, f)}
                                  disabled={savingTemplate}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirm({ ageGroup: group, key: f.key })}
                                  disabled={savingTemplate}
                                  title="Quitar de la plantilla"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Propuestas por entrenadores</CardTitle>
          <CardDescription>
            Tests agregados por entrenadores en cada escuela. Aceptá los que quieras incorporar a la plantilla básica para que estén disponibles en todas las escuelas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConfigs ? (
            <Skeleton className="h-32 w-full" />
          ) : proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay propuestas pendientes. Los entrenadores pueden agregar tests personalizados en la configuración de evaluaciones físicas de su escuela.
            </p>
          ) : (
            <div className="space-y-3">
              {proposals.map(({ schoolId, schoolName, ageGroup, field }) => {
                const compositeKey = `${ageGroup}:${field.key}:${schoolName}`;
                const isAccepting = acceptingKey === compositeKey;
                const ageLabel = AGE_GROUPS.find((a) => a.group === ageGroup)?.label ?? ageGroup;
                const Icon = field.category ? CATEGORY_ICONS[field.category] : Activity;
                return (
                  <div
                    key={`${schoolId}-${ageGroup}-${field.key}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div>
                        <span className="font-medium">{field.label}</span>
                        {field.unit && (
                          <span className="text-muted-foreground text-sm"> ({field.unit})</span>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {schoolName} · {ageLabel}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={isAccepting}
                      onClick={() => handleAccept(ageGroup, field, schoolName)}
                    >
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      Aceptar en plantilla
                    </Button>
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
        onSave={(data) => {
          handleSaveTemplateField(data);
        }}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => !savingTemplate && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este test de la plantilla básica?</AlertDialogTitle>
            <AlertDialogDescription>
              El test dejará de estar disponible en la plantilla para todas las escuelas. Las escuelas que ya lo usen en sus evaluaciones no perderán los datos guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingTemplate}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={savingTemplate}
              onClick={() =>
                deleteConfirm && handleRemoveFromTemplate(deleteConfirm.ageGroup, deleteConfirm.key)
              }
            >
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Quitar de la plantilla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
