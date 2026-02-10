export interface PlatformUser {
  id: string; // auth uid
  email: string;
  super_admin: boolean;
  createdAt: Date;
}

export interface School {
  id: string;
  name: string;
  city: string;
  province: string;
  address: string;
  logoUrl?: string;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  schoolId: string;
  createdAt: Date;
}

// Representa la membresía y el rol de un usuario en una escuela específica.
export interface SchoolUser {
  id: string; // auth uid
  displayName: string;
  email: string;
  role: 'school_admin' | 'coach' | 'player';
  assignedCategories?: string[]; // IDs de las categorías asignadas
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  dni?: string;
  healthInsurance?: string;
  /** Email para que el jugador pueda iniciar sesión en el panel (opcional). */
  email?: string;
  tutorContact: {
    name: string;
    phone: string;
  };
  status: 'active' | 'inactive' | 'suspended';
  photoUrl?: string;
  observations?: string;
  /** Altura en cm (datos físicos de referencia). */
  altura_cm?: number;
  /** Peso en kg (datos físicos de referencia). */
  peso_kg?: number;
  /** Envergadura en cm (distancia entre las puntas de los dedos con brazos extendidos). */
  envergadura_cm?: number;
  /** Pie predominante (lateralidad). */
  pie_dominante?: 'derecho' | 'izquierdo' | 'ambidiestro';
  /** Posición preferida en cancha. */
  posicion_preferida?: 'delantero' | 'mediocampo' | 'defensor' | 'arquero';
  /** Número de camiseta (opcional). */
  numero_camiseta?: number;
  /** Talle de camiseta (opcional). */
  talle_camiseta?: string;
  createdAt: Date;
  createdBy: string; // uid
  // No está en el modelo de Firestore, se añade en el frontend.
  escuelaId?: string; 
}

export interface PendingPlayer {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  /** Email verificado (obligatorio en registro web). */
  email: string;
  dni?: string;
  tutorContact: {
    name: string;
    phone: string;
  };
  submittedAt: Date;
  /** UID del usuario Auth que completó el registro. */
  submittedBy?: string;
}

/** Intentos temporales de verificación de email en registro web. Se eliminan tras verificar o expirar. */
export interface EmailVerificationAttempt {
  id: string;
  email: string;
  playerData: {
    firstName: string;
    lastName: string;
    birthDate: Date;
    schoolId: string;
    tutorPhone: string;
    category?: string;
  };
  status: 'pending' | 'verified' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

/** Solicitud de acceso al panel de un usuario ya logueado (ej. jugador que pide ser dado de alta). */
export interface AccessRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  type: "player";
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  /** Rellenado al aprobar: escuela y jugador vinculado. */
  approvedSchoolId?: string;
  approvedPlayerId?: string;
  approvedAt?: Date;
}


export interface Training {
    id: string;
    date: Date;
    /** Formato YYYY-MM-DD para consultas por fecha */
    dateStr?: string;
    createdAt: Date;
    createdBy: string; // uid
}

export interface Attendance {
    id: string; // player id (document id)
    status: 'presente' | 'ausente' | 'justificado';
    reason?: string;
    /** Denormalizado para consulta por jugador en collectionGroup */
    playerId?: string;
    trainingId?: string;
    trainingDate?: Date;
}

/** Posición del jugador calificada por el entrenador. */
export type PlayerPosition = 'delantero' | 'mediocampo' | 'defensor' | 'arquero';

// Unifica todas las evaluaciones en un solo documento por fecha.
export interface Evaluation {
  id:string;
  playerId: string;
  date: Date;
  /** Posición que el entrenador califica como la más adecuada para el jugador. */
  position?: PlayerPosition;
  coachComments: string;
  /** Comentarios opcionales por rubro (ej. control, pase, respect). */
  rubricComments?: Record<string, string>;
  physical?: {
    height?: { value: number, unit: 'cm' };
    weight?: { value: number, unit: 'kg' };
    speed20m?: { value: number, unit: 's' };
    resistanceBeepTest?: { value: number, unit: 'level' };
    agilityTest?: { value: number, unit: 's' };
  };
  technical?: Record<string, number>; // Cambiado a number para los sliders
  tactical?: Record<string, number>;
  socioEmotional?: {
    respect?: number;
    responsibility?: number;
    teamwork?: number;
    empathy?: number;
    resilience?: number;
    learningAttitude?: number;
  };
  criticalIncident?: {
    type: 'verbal_aggression' | 'physical_aggression';
    comment: string;
    reportedBy: string; // uid
    reportedAt: Date;
  };
  createdAt: Date;
  createdBy: string; // uid
}


// Perfil de usuario unificado para usar en el frontend
export interface UserProfile extends SchoolUser {
    uid: string;
    isSuperAdmin: boolean;
    activeSchoolId?: string;
    memberships: SchoolMembership[];
    /** ID del jugador en la escuela cuando el rol es 'player'. */
    playerId?: string;
}

export interface SchoolMembership {
    schoolId: string;
    role: 'school_admin' | 'coach' | 'player';
}

/** Evaluación física del jugador. Campos varían según edad. */
export type PhysicalAgeGroup = '5-8' | '9-12' | '13-15' | '16-18';

/** Tests para 5–8 años */
export interface PhysicalTests58 {
  sprint_20m_seg?: number;
  salto_horizontal_cm?: number;
  equilibrio_seg?: number;
  circuito_coordinacion_seg?: number;
  observacion_coordinacion?: string;
}

/** Tests para 9–12 años */
export interface PhysicalTests912 {
  sprint_30m_seg?: number;
  salto_horizontal_cm?: number;
  salto_vertical_cm?: number;
  test_6min_metros?: number;
  test_agilidad_seg?: number;
}

/** Tests para 13–15 años */
export interface PhysicalTests1315 {
  sprint_10m_seg?: number;
  sprint_30m_seg?: number;
  course_navette_nivel?: number;
  salto_vertical_cm?: number;
  flexiones_1min?: number;
}

/** Tests para 16–18 años */
export interface PhysicalTests1618 {
  sprint_10m_seg?: number;
  sprint_30m_seg?: number;
  sprint_40m_seg?: number;
  cooper_metros?: number;
  yo_yo_nivel?: number;
  salto_vertical_cm?: number;
  plancha_seg?: number;
  observacion_asimetrias?: string;
}

export type PhysicalTests = PhysicalTests58 | PhysicalTests912 | PhysicalTests1315 | PhysicalTests1618;

/** Definición mínima de un campo personalizado o override (para config). */
export interface PhysicalFieldDef {
  key: string;
  label: string;
  unit?: string;
  type: "number" | "text";
  min?: number;
  max?: number;
  placeholder?: string;
  category?: "velocidad" | "fuerza" | "resistencia" | "coordinacion" | "agilidad" | "flexibilidad" | "observacion";
}

/** Override de propiedades de un campo predefinido. */
export interface PhysicalFieldOverride {
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

/** Configuración de qué tests medir por escuela (coach puede activar/desactivar, agregar y editar). */
export interface PhysicalAssessmentConfig {
  id: string;
  /** Por grupo etario: array de keys de campos habilitados. Si vacío/ausente, se usan todos por defecto. */
  enabledFieldsByAgeGroup: Partial<Record<PhysicalAgeGroup, string[]>>;
  /** Tests personalizados agregados por el coach por grupo etario. */
  customFieldsByAgeGroup?: Partial<Record<PhysicalAgeGroup, PhysicalFieldDef[]>>;
  /** Ediciones (label, unit, min, max) aplicadas a tests predefinidos por grupo. */
  fieldOverridesByAgeGroup?: Partial<Record<PhysicalAgeGroup, Record<string, PhysicalFieldOverride>>>;
  updatedAt: Date;
  updatedBy: string;
}

export interface PhysicalAssessment {
  id: string;
  playerId: string;
  date: Date;
  edad_en_meses: number;
  altura_cm: number;
  peso_kg: number;
  imc: number;
  observaciones_generales?: string;
  /** Tests según grupo de edad */
  tests: PhysicalTests;
  ageGroup: PhysicalAgeGroup;
  createdAt: Date;
  createdBy: string;
}

/** Video subido o grabado por el entrenador, asociado a un jugador (videoteca). */
export interface PlayerVideo {
  id: string;
  playerId: string;
  /** Ruta en Firebase Storage, ej: schools/{schoolId}/players/{playerId}/videos/{id}.webm */
  storagePath: string;
  /** URL pública de descarga/reproducción */
  url: string;
  /** Título opcional, ej. "Control de balón", "Entrenamiento 12/01" */
  title?: string;
  /** Descripción o notas del entrenador */
  description?: string;
  /** Habilidades/categorías: dribling, pegada, definicion, estirada, etc. */
  skills?: string[];
  createdAt: Date;
  createdBy: string;
}

// Re-export support types
export * from './support';
// Re-export payments types
export * from './payments';
