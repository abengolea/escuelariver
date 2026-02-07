'use client';

import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import type { UserProfile as UserProfileType } from '@/lib/types';


export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const { data: profile, loading: profileLoading, error } = useDoc<UserProfileType>(user ? `users/${user.uid}` : '');

  const isReady = !authLoading && !profileLoading && !!user && !!profile;

  return {
    user,
    profile,
    loading: authLoading || profileLoading,
    isReady,
    isAdmin: profile?.role === 'admin',
    isCoach: profile?.role === 'entrenador',
    error,
  };
}
