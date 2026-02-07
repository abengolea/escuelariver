import { type Timestamp } from "firebase/firestore";

export interface PlatformUser {
  id: string;
  super_admin: boolean;
}

export interface School {
  id: string;
  name: string;
  city: string;
  province: string;
  address: string;
  logoUrl?: string;
  status: 'active' | 'suspended';
  createdAt: Timestamp;
}

// User's role within a specific school
export interface SchoolUser {
  id: string; // same as auth uid
  displayName: string;
  email: string;
  role: 'school_admin' | 'coach';
  assignedCategories: string[]; // array of categoryIds
}

export interface Category {
  id: string;
  name: string; // "U6", "U8"
  schoolId: string;
}

export interface Player {
  id: string;
  // schoolId is implicitly known from the collection path
  categoryId: string;
  firstName: string;
  lastName: string;
  birthDate: Date | Timestamp;
  tutorContact: {
    name: string;
    phone: string;
  };
  status: 'active' | 'inactive';
  photoUrl?: string;
  observations?: string;
  createdAt: Timestamp;
  createdBy: string; // uid
  // This is not part of the data model, but useful for the UI
  escuelaId?: string;
}

export interface Training {
    id: string;
    categoryId: string;
    date: Timestamp;
    createdAt: Timestamp;
    createdBy: string; // uid
}

export interface Attendance {
    id: string; // same as playerId
    status: 'present' | 'absent';
    reason?: string;
}

export interface Evaluation {
  id: string;
  playerId: string;
  categoryId: string;
  date: Timestamp;
  physical?: {
    height?: number; // cm
    weight?: number; // kg
    speed20m?: number; // seconds
    resistanceBeepTest?: number; // level
    agility?: number; // seconds
  };
  technical: {
    ballControl: 1 | 2 | 3 | 4 | 5;
    passing: 1 | 2 | 3 | 4 | 5;
    dribbling: 1 | 2 | 3 | 4 | 5;
    shooting: 1 | 2 | 3 | 4 | 5;
    coordination: 1 | 2 | 3 | 4 | 5;
  };
  tactical: {
    positioning: 1 | 2 | 3 | 4 | 5;
    decisionMaking: 1 | 2 | 3 | 4 | 5;
    teamwork: 1 | 2 | 3 | 4 | 5;
  };
  coachComments: string;
  createdAt: Timestamp;
  createdBy: string; // uid
}

// This is a merged type for easy access in the UI
export interface UserProfile extends SchoolUser {
    uid: string;
    isSuperAdmin: boolean;
    // We'll add the active school here
    activeSchoolId?: string;
    // A list of all schools the user is a member of
    memberships: SchoolMembership[];
}

export interface SchoolMembership {
    schoolId: string;
    role: 'school_admin' | 'coach';
}
