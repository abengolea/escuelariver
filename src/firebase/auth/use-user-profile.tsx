'use client';

import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import { useCollection } from '../firestore/use-collection';
import type { PlatformUser, SchoolUser, UserProfile, SchoolMembership } from '@/lib/types';
import { useMemo } from 'react';

// For the MVP, we will use a hardcoded active school.
// In the future, this would come from a user selection.
const ACTIVE_SCHOOL_ID = 'escuela-123-sn';

/**
 * A hook to get the complete profile for the current user, including global
 * and school-specific roles.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  
  // Fetch the global platform user profile (to check for super_admin)
  const { data: platformUser, loading: platformUserLoading } = useDoc<PlatformUser>(
    user ? `platformUsers/${user.uid}` : ''
  );
  
  // In a real app, we would query the 'users' collection group to find all
  // school memberships. For this MVP, we'll just check the hardcoded school.
  const { data: schoolUser, loading: schoolUserLoading } = useDoc<SchoolUser>(
    user ? `schools/${ACTIVE_SCHOOL_ID}/users/${user.uid}` : ''
  );

  const loading = authLoading || platformUserLoading || schoolUserLoading;

  const profile: UserProfile | null = useMemo(() => {
    if (loading || !user || !schoolUser) {
      return null;
    }

    const membership: SchoolMembership = {
        schoolId: ACTIVE_SCHOOL_ID,
        role: schoolUser.role,
    };

    return {
      ...schoolUser,
      uid: user.uid,
      isSuperAdmin: platformUser?.super_admin ?? false,
      activeSchoolId: ACTIVE_SCHOOL_ID,
      memberships: [membership],
    };
  }, [loading, user, platformUser, schoolUser]);


  const isReady = !loading && !!profile;

  return {
    user,
    profile,
    loading,
    isReady,
    activeSchoolId: profile?.activeSchoolId,
    // Role checks are now based on the active school profile
    isAdmin: profile?.isSuperAdmin || profile?.role === 'school_admin',
    isCoach: profile?.role === 'coach',
    isSuperAdmin: profile?.isSuperAdmin,
  };
}
