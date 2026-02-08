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

// Representa la membresía y el rol de un usuario en una escuela específica.
export interface SchoolUser {
  id: string; // auth uid
  displayName: string;
  email: string;
  role: 'school_admin' | 'coach';
  // Los IDs de las categorías que un 'coach' tiene asignadas.
  // Para 'school_admin' puede estar vacío o no aplicar.
  assignedCategories: string[]; 
}

export interface Category {
  id: string;
  name: string; // "U6", "U8"
  schoolId: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  categoryId: string; // ID de la categoría actual
  tutorContact: {
    name: string;
    phone: string;
  };
  status: 'active' | 'inactive';
  photoUrl?: string;
  observations?: string;
  createdAt: Date;
  createdBy: string; // uid
  // No está en el modelo de Firestore, se añade en el frontend.
  escuelaId?: string; 
}

export interface Training {
    id: string;
    categoryId: string;
    date: Date;
    createdAt: Date;
    createdBy: string; // uid
}

export interface Attendance {
    id: string; // player id
    status: 'presente' | 'ausente' | 'justificado';
    reason?: string;
}

// Unifica todas las evaluaciones en un solo documento por fecha.
export interface Evaluation {
  id:string;
  playerId: string;
  categoryId: string;
  date: Date;
  coachComments: string;
  physical?: {
    height?: { value: number, unit: 'cm' };
    weight?: { value: number, unit: 'kg' };
    speed20m?: { value: number, unit: 's' };
    resistanceBeepTest?: { value: number, unit: 'level' };
    agilityTest?: { value: number, unit: 's' };
  };
  technical?: Record<string, 1 | 2 | 3 | 4 | 5>;
  tactical?: Record<string, 1 | 2 | 3 | 4 | 5>;
  socioEmotional?: {
    respect: 1 | 2 | 3 | 4;
    responsibility: 1 | 2 | 3 | 4;
    teamwork: 1 | 2 | 3 | 4;
    empathy: 1 | 2 | 3 | 4;
    resilience: 1 | 2 | 3 | 4;
    learningAttitude: 1 | 2 | 3 | 4;
    evidence?: string[]; // Chips o comentarios cortos
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
}

export interface SchoolMembership {
    schoolId: string;
    role: 'school_admin' | 'coach';
}
