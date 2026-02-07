import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(birthDate: Date | Timestamp): number {
  const birthDateAsDate = birthDate instanceof Date ? birthDate : birthDate.toDate();
  const today = new Date();
  let age = today.getFullYear() - birthDateAsDate.getFullYear();
  const monthDiff = today.getMonth() - birthDateAsDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateAsDate.getDate())) {
    age--;
  }
  
  return age;
}
