# Proyecto: Grupos de Entrenamiento y Cat. Año de Nacimiento

**Fecha:** Marzo 2025  
**Referencia:** Planilla Escuela River San Nicolás (marzo)

---

## 1. Resumen ejecutivo

Cada escuela debe poder organizar sus **categorías** y **grupos de entrenamiento** a medida. Los cambios principales son:

1. **Cambio de denominación:** "Categoría" pasa a llamarse **"Cat. año de nacimiento"** (ej. "09" por 2009, "15" por 2015).
2. **Grupos de entrenamiento configurables:** La escuela define sus turnos (Lunes 16:00, Arqueros, Femenino, etc.) y qué jugadores pertenecen a cada uno.
3. **Planilla de asistencia:** Organizada por **grupos de entrenamiento** (turnos), no por categoría.

---

## 2. Análisis de la referencia: Planilla River San Nicolás

### 2.1 Estructura observada

| Campo | Descripción |
|-------|-------------|
| **TURNO** | Identifica el grupo/horario (ej. "LUNES 16.00 A 17.15", "ARQUEROS LUNES 18:00 HS", "FEMENINO LUNES 18:15") |
| **CATEGORIA** | Año de nacimiento: 2008, 2009, 2010, 2011... 2021 |
| **NOMBRE Y APELLIDO** | Jugador |
| **PRESENTE/AUSENTE** | Estado de asistencia |

### 2.2 Tipos de turnos en la referencia

- **Turnos por horario + rango de edades:** Ej. Lunes 16:00 (2015–2018), Martes 17:45 (2019–2021)
- **Turnos femenino:** Ej. Lunes 18:15, Miércoles 18:15 (mezcla de años 2015–2021)
- **Turnos arqueros:** Ej. Arqueros Lunes 18:00, Arqueros Miércoles 16:00, Arqueros Viernes 16:30 / 18:00

### 2.3 Conclusiones

1. La **categoría** es el **año de nacimiento** (no SUB-X).
2. La **planilla se organiza por TURNO (grupo de entrenamiento)**, no por categoría.
3. Un mismo día puede tener varios turnos con horarios distintos.
4. Un turno puede agrupar varias categorías (años) y géneros según el caso.
5. Los turnos de arqueros son específicos y pueden incluir jugadores de distintas edades.

---

## 3. Estado actual del sistema

### 3.1 Categoría actual

- **Fuente:** `getCategoryLabel(birthDate)` → SUB-5, SUB-6, ... SUB-18
- **Cálculo:** Edad que cumple en el año en curso (año actual - año nacimiento)
- **Uso:** Filtros, pagos, horarios, planilla de asistencia

### 3.2 Horarios de entrenamiento (TrainingSlot)

- **Ubicación:** Gestión en `/dashboard/training-schedules` (no en Gestión Escuela)
- **Campos:** `dayOfWeek`, `time`, `categoryFrom`, `categoryTo`, `tipoCategoria` (masculino/femenino), `maxQuota`, `coachId`
- **Asignación de jugadores:** Automática según rango SUB-X y género
- **Limitación:** No hay tipo "arqueros" ni asignación por posición

### 3.3 Planilla de asistencia

- **Ubicación:** `/dashboard/attendance`
- **Organización actual:** Por **edad** (Sub-5, Sub-6, Sub-7...) con `groupPlayersByAge()`
- **Modelo de datos:** Un `Training` por fecha (date, dateStr). Asistencia en `trainings/{id}/attendance/{playerId}`

### 3.4 Gestión Escuela

- **Ubicación:** `/dashboard/schools/[schoolId]`
- **Contenido actual:** Tabs "Responsables" y "Jugadores"
- **No incluye:** Configuración de categorías ni grupos de entrenamiento

---

## 4. Cambios propuestos

### 4.1 Fase 1: Cat. año de nacimiento

| Aspecto | Cambio |
|---------|--------|
| **Denominación** | Reemplazar "Categoría" por "Cat. año nac." en toda la UI |
| **Etiqueta** | Mostrar año (09, 15, 18) en lugar de SUB-X |
| **Funciones** | Añadir `getBirthYearLabel(birthDate)` → "09", "15"; mantener `getCategoryLabel` para compatibilidad interna si se necesita |
| **Orden** | Ordenar por año descendente (más grande = más chico; 2021 antes que 2008) |

**Archivos afectados:**

- `src/lib/utils.ts` (nuevas funciones / adaptación)
- `src/components/players/PlayerTable.tsx`
- `src/components/players/AddPlayerForm.tsx`, `EditPlayerDialog.tsx`
- `src/components/admin/MassMessageForm.tsx`
- `src/components/training/TrainingSchedulesPanel.tsx`
- `src/components/payments/PaymentConfigTab.tsx`
- `src/lib/payments/db.ts` (mantener mapeo SUB-X ↔ año para pagos si hace falta)

### 4.2 Fase 2: Grupos de entrenamiento configurables

**Concepto:** Un **Grupo de Entrenamiento** es un turno definido por la escuela con nombre, día, horario, tipo y reglas de inclusión.

#### Modelo de datos (evolución de TrainingSlot)

```
TrainingSlot (evolucionar el actual)
├── name            // NUEVO: "Lunes 16:00", "Arqueros Lunes", "Femenino" (define la escuela)
├── daysOfWeek      // NUEVO: [1, 3] = Lunes y Miércoles (o mantener dayOfWeek si se duplica)
├── dayOfWeek       // actual: 0-6 (o reemplazar por daysOfWeek[])
├── time            // "16:00"
├── timeEnd?        // "17:15" (opcional)
├── tipoCategoria   // ACTUALIZAR: "masculino" | "femenino" | "arqueros" | "" (mixto)
├── yearFrom        // NUEVO: año nac. mínimo (reemplaza categoryFrom)
├── yearTo          // NUEVO: año nac. máximo (reemplaza categoryTo)
├── categoryFrom    // legacy, migrar a yearFrom
├── categoryTo      // legacy, migrar a yearTo
├── maxQuota        // editable
├── coachId
├── manualPlayerIds?  // NUEVO: IDs de jugadores agregados manualmente (fuera de reglas)
└── order           // para ordenar en planilla
```

**Tipo "arqueros":** Solo jugadores con `posicion_preferida === "arquero"`.

#### Dónde configurar

**Decisión:** Mantener y mejorar la pantalla **Entrenamientos** (`/dashboard/training-schedules`). No crear pestaña nueva en Gestión Escuela.

### 4.3 Fase 3: Planilla de asistencia por grupos

**Comportamiento objetivo:**

1. Usuario elige **fecha**.
2. El sistema determina el **día de la semana** de esa fecha.
3. Se listan los **grupos de entrenamiento** que entrenan ese día.
4. Para cada grupo se muestra la lista de jugadores asignados, con columna "Cat. año nac.".
5. Se toma asistencia (presente/ausente) por jugador.

**Consideraciones técnicas:**

- **Training actual:** Se mantiene un `Training` por fecha (o uno por fecha+grupo si se cambia el modelo).
- **Asistencia:** Sigue en `trainings/{id}/attendance/{playerId}`.
**Decisión:** Asistencia se marca **por turno** (no por día). Cada turno tiene su propia lista de presente/ausente.

**Estructura de datos:** Crear `Training` por fecha+grupo: `trainings` con `dateStr` + `groupId`.

---

## 5. Impacto en otros módulos

| Módulo | Impacto |
|--------|---------|
| **Pagos** | `amountByCategory`, `registrationAmountByCategory` usan SUB-X. Requiere mapeo año↔SUB-X o migrar a años. |
| **Evaluaciones físicas** | Usan `PhysicalAgeGroup` (5-8, 9-12, etc.), no categoría SUB-X. Sin cambio directo. |
| **Mensajes masivos** | Filtro por categoría: pasar a filtro por año nacimiento. |
| **Videoteca** | Sin uso de categoría. Sin cambio. |
| **Registro web** | `category` en EmailVerificationAttempt: migrar a año si aplica. |
| **Reportes / analíticas** | Cualquier informe que use categoría debe usar año de nacimiento. |

---

## 6. Fases de implementación sugeridas

### Fase 1 – Cat. año de nacimiento
- Crear `getBirthYearLabel()` y orden por año.
- Reemplazar "Categoría" por "Cat. año nac." en la UI.
- Migrar pagos a año de nacimiento (`amountByYear`). Actualizar mensajes masivos y reportes.

### Fase 2 – Mejoras en pantalla Entrenamientos
- Varios días por slot. Cupo editable. Tipo Arqueros. Nombre del grupo. Asignación manual.

### Fase 3 – Planilla por grupos
- Modificar `AttendanceSheet` para agrupar por grupo en lugar de por edad.
- Asistencia por turno. Crear `Training` por fecha+grupo. Columna "Cat. año nac.".

### Fase 4 – Limpieza
- Eliminar referencias a SUB-X. Pruebas de regresión.

---

## 7. Decisiones tomadas

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | Asistencia por día vs. por turno | **Por turno.** Cada turno tiene su propia planilla presente/ausente. |
| 2 | Cuotas por SUB-X o por año nacimiento | **Por año de nacimiento.** Las categorías se modifican totalmente: desaparece SUB-X, se usa año (09, 15, etc.). |
| 3 | Pantalla Entrenamientos | **Dejarla y mejorarla.** No reemplazar; es la misma pantalla a evolucionar. |
| 4 | Nombre del grupo | **Lo define la escuela.** Campo libre (ej. "Lunes 16:00", "Arqueros", "Femenino"). |
| 5 | Asignación manual de jugadores | **Sí.** Se puede agregar jugadores fuera de las reglas (manual + reglas automáticas). |

---

## 8. Mejoras a la pantalla Entrenamientos

La pantalla actual (`/dashboard/training-schedules`) se mantiene y debe mejorarse con:

### 8.1 Varios días de entrenamiento

- **Permitir configurar varios días** para un mismo grupo/horario. Hoy cada slot es día + hora único. Se debe poder, por ejemplo, definir "Lunes y Miércoles 16:00" como un mismo grupo, o duplicar fácilmente un slot en otros días.

### 8.2 Cupo editable

- **El cupo debe ser editable** al crear y al editar un horario. Si hoy está fijo o no se guarda bien, corregir el bug.

### 8.3 Categoría Arqueros

- **Agregar tipo "Arqueros"** al tipo de categoría. Hoy solo existe Masculino/Femenino. Debe existir la opción **Arqueros** para turnos de arqueros (solo jugadores con `posicion_preferida === "arquero"`).

### 8.4 Resumen de cambios en Entrenamientos

| Mejora | Descripción |
|--------|-------------|
| Varios días | Poder asignar un grupo a varios días (ej. Lunes + Miércoles) o duplicar slots fácilmente |
| Cupo editable | Asegurar que el cupo se pueda cambiar al editar y que se guarde correctamente |
| Tipo Arqueros | Nueva opción "Arqueros" además de Masculino y Femenino |
| Nombre del grupo | Campo libre para que la escuela nombre cada grupo (ej. "Arqueros Lunes") |

---

## 9. Archivos clave a modificar

```
src/lib/utils.ts                    # getBirthYearLabel, orden por año nacimiento
src/lib/types/index.ts              # TrainingSlot: agregar tipoCategoria "arqueros", nombre grupo
src/components/attendance/          # AttendanceSheet: agrupar por turno, asistencia por grupo
src/components/training/            # TrainingSchedulesPanel: varios días, cupo editable, tipo Arqueros, nombre grupo
src/lib/payments/db.ts              # Migrar a año de nacimiento (amountByCategory → amountByYear)
src/lib/training-config.ts         # Slots con varios días, nombre, tipo arqueros
```

---

## 10. Diagrama de flujo propuesto (Planilla de asistencia)

```
[Usuario selecciona fecha]
        │
        ▼
[Obtener día de la semana: Lunes, Martes, ...]
        │
        ▼
[Obtener grupos de entrenamiento para ese día]
        │
        ▼
[Para cada grupo:]
  - Filtrar jugadores según reglas del grupo
  - Mostrar sección: "LUNES 16:00 A 17:15"
  - Lista: Nombre | Cat. año nac. | ☐ Presente/Ausente
        │
        ▼
[Guardar asistencia]
```

---

*Documento de diseño. No incluye implementación; sirve como base para planificación y desarrollo.*
