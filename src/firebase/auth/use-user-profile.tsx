'use client';

import { useUser } from './use-user';
import { useFirestore } from '../provider';
import type { PlatformUser, SchoolUser, UserProfile, SchoolMembership } from '@/lib/types';
import { useDoc } from '../firestore/use-doc';
import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';


// This type extends SchoolMembership to include the full user data found in the subcollection,
// as the collection group query returns the whole document.
type FullSchoolMembership = SchoolMembership & Omit<SchoolUser, 'id'>;

/**
 * A hook to get the complete profile for the current user, including global
 * and school-specific roles by searching across all schools.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();

  // State for school memberships
  const [memberships, setMemberships] = useState<FullSchoolMembership[] | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  
  // Fetch global platform roles (e.g., isSuperAdmin)
  const { data: platformUser, loading: platformUserLoading } = useDoc<PlatformUser>(
    user ? `platformUsers/${user.uid}` : ''
  );
  
  const isSuperAdmin = useMemo(() => platformUser?.super_admin ?? false, [platformUser]);

  // Fetch all school memberships for the user using a collection group query
  useEffect(() => {
    // Don't run query if we don't have a user, firestore, or if the user is a super admin
    if (!user || !firestore || isSuperAdmin) {
      setMemberships([]); // Super admin has no specific school memberships in this context
      setMembershipsLoading(false);
      return;
    }

    setMembershipsLoading(true);
    // This query finds all documents in any 'users' subcollection where the user's ID matches.
    const userRolesQuery = query(
      collectionGroup(firestore, 'users'),
      where('__name__', '==', `schools/${user.uid}`) // This is a placeholder, as we need to query by document ID.
                                                    // A real query would be on a field like `email` or `uid`.
                                                    // Let's query by UID, assuming the doc ID is the UID.
    );

    // Because we can't directly query by document ID in a collection group query this way,
    // we'll query by a field that should be unique, like email.
    const finalUserRolesQuery = query(
        collectionGroup(firestore, 'users'),
        where('email', '==', user.email)
    );


    getDocs(finalUserRolesQuery).then(snapshot => {
      if (snapshot.empty) {
        setMemberships([]);
      } else {
        const userMemberships: FullSchoolMembership[] = snapshot.docs.map(doc => {
          // The path is schools/{schoolId}/users/{userId}
          const schoolId = doc.ref.parent.parent!.id;
          const schoolUserData = doc.data() as SchoolUser;
          return {
            schoolId: schoolId,
            role: schoolUserData.role,
            displayName: schoolUserData.displayName,
            email: schoolUserData.email,
            assignedCategories: schoolUserData.assignedCategories,
          };
        });
        setMemberships(userMemberships);
      }
      setMembershipsLoading(false);
    }).catch(error => {
        console.error("Error fetching user memberships:", error);
        setMemberships([]);
        setMembershipsLoading(false);
    });

  }, [user, firestore, isSuperAdmin]);


  const loading = authLoading || platformUserLoading || membershipsLoading;

  const profile: UserProfile | null = useMemo(() => {
    if (loading || !user) {
      return null;
    }

    // Handle super admin case first
    if (isSuperAdmin) {
      return {
        uid: user.uid,
        displayName: user.displayName || user.email || 'Super Admin',
        email: user.email!,
        role: 'school_admin', // Effective role
        assignedCategories: [],
        isSuperAdmin: true,
        activeSchoolId: undefined, // Super admin can switch schools in the UI
        memberships: [], // Does not have explicit school memberships
      };
    }

    // Handle regular user. They need at least one membership to have a profile.
    if (!memberships || memberships.length === 0) {
      return null;
    }

    // For now, pick the first membership as the active one.
    // A UI to switch schools would be a future improvement.
    const activeMembership = memberships[0];
    const { schoolId, ...schoolUserData } = activeMembership;

    return {
      ...schoolUserData,
      uid: user.uid,
      isSuperAdmin: false,
      activeSchoolId: schoolId,
      memberships: memberships,
    };
  }, [loading, user, isSuperAdmin, memberships]);


  const isReady = !loading;

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
