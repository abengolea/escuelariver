'use client';

import { useUser } from './use-user';
import { useDoc } from '../firestore/use-doc';
import type { PlatformUser, SchoolUser, UserProfile, SchoolMembership } from '@/lib/types';
import { useMemo } from 'react';

// For the MVP, we will use a hardcoded active school.
// In a real app, this would come from a user selection.
const ACTIVE_SCHOOL_ID = 'escuela-123-sn';

/**
 * A hook to get the complete profile for the current user, including global
 * and school-specific roles.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  
  const { data: platformUser, loading: platformUserLoading } = useDoc<PlatformUser>(
    user ? `platformUsers/${user.uid}` : ''
  );
  
  const { data: schoolUser, loading: schoolUserLoading } = useDoc<SchoolUser>(
    user ? `schools/${ACTIVE_SCHOOL_ID}/users/${user.uid}` : ''
  );

  const loading = authLoading || platformUserLoading || schoolUserLoading;

  const profile: UserProfile | null = useMemo(() => {
    if (loading || !user) {
      return null;
    }

    const isSuperAdmin = platformUser?.super_admin ?? false;

    // Handle super admin case first. They might not be in a school.
    if (isSuperAdmin) {
      return {
        uid: user.uid,
        displayName: user.displayName || user.email || 'Super Admin',
        email: user.email!,
        role: 'school_admin', // A super admin can have a base role
        assignedCategories: [],
        isSuperAdmin: true,
        activeSchoolId: schoolUser ? ACTIVE_SCHOOL_ID : undefined,
        memberships: schoolUser ? [{ schoolId: ACTIVE_SCHOOL_ID, role: schoolUser.role }] : [],
      };
    }

    // If not super admin, they MUST be a school user to have a profile.
    if (!schoolUser) {
      return null;
    }

    const membership: SchoolMembership = {
        schoolId: ACTIVE_SCHOOL_ID,
        role: schoolUser.role,
    };

    return {
      ...schoolUser,
      uid: user.uid,
      isSuperAdmin: false,
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
    isAdmin: profile?.isSuperAdmin || profile?.role === 'school_admin',
    isCoach: profile?.role === 'coach',
    isSuperAdmin: profile?.isSuperAdmin ?? false,
  };
}
