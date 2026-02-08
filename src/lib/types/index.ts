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
  role: 'school_admin' | 'coach';
  assignedCategories?: string[]; // IDs de las categorías asignadas
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  dni?: string;
  healthInsurance?: string;
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
  date: Date;
  coachComments: string;
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
}

export interface SchoolMembership {
    schoolId: string;
    role: 'school_admin' | 'coach';
}
