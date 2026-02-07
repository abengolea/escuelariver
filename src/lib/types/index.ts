export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  category: string; // "U10"
  primaryPosition: string; // "Delantero"
  status: "activo" | "inactivo" | "lesionado";
  avatarUrl: string;
  height: number;
  weight: number;
  city: string;
  clubId: string;
};

export type PhysicalTest = {
  id: string;
  testType: string;
  date: Date;
  value: number;
  unit: string;
};

export type TechnicalEvaluation = {
  id: string;
  date: Date;
  scores: {
    ballControl: number;
    passing: number;
    dribbling: number;
    shooting: number;
  };
  observations?: string;
};

export type TacticalEvaluation = {
  id: string;
  date: Date;
  scores: {
    positioning: number;
    decisionMaking: number;
    gameReading: number;
    defensiveAwareness: number;
  };
  observations?: string;
};

export type Session = {
  id: string;
  date: Date;
  type: "entrenamiento" | "partido";
  category: string;
  opponent?: string;
};

export type Injury = {
  id: string;
  bodyPart: string;
  injuryDate: Date;
  status: "activo" | "recuperando" | "alta";
  severity: "leve" | "moderada" | "grave";
}

export type UserProfile = {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: 'admin' | 'entrenador';
  clubId: string;
}
