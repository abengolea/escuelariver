'use client';

import { useUser } from './use-user';
import { useFirestore } from '../provider';
import type { PlatformUser, SchoolUser, UserProfile, SchoolMembership } from '@/lib/types';
import { useDoc } from '../firestore/use-doc';
import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, query, where, getDocs, getDoc, doc, type FirestoreError } from 'firebase/firestore';


// This type extends SchoolMembership to include the full user data found in the subcollection,
// as the collection group query returns the whole document.
type FullSchoolMembership = SchoolMembership & Omit<SchoolUser, 'id'> & { playerId?: string };

const MEMBERSHIP_ROLE_ORDER: Record<string, number> = {
  school_admin: 0,
  coach: 1,
  editor: 2,
  viewer: 3,
  player: 4,
};

function sortMembershipsByRole(memberships: FullSchoolMembership[]): FullSchoolMembership[] {
  return [...memberships].sort(
    (a, b) =>
      (MEMBERSHIP_ROLE_ORDER[a.role] ?? 99) - (MEMBERSHIP_ROLE_ORDER[b.role] ?? 99)
  );
}

/**
 * A hook to get the complete profile for the current user, including global
 * and school-specific roles by searching across all schools.
 */
export function useUserProfile() {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();

  // State for school memberships and derived super admin status
  const [memberships, setMemberships] = useState<FullSchoolMembership[] | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Use a separate `useDoc` hook for the platform user data, but don't let it block the main logic.
  const { data: platformUser } = useDoc<PlatformUser>(user ? `platformUsers/${user.uid}` : '');

  useEffect(() => {
    // 1. Wait for authentication to complete
    if (authLoading) {
      return;
    }
    
    // 2. If there's no user, we're done.
    if (!user) {
        setIsSuperAdmin(false);
        setMemberships([]);
        setProfileLoading(false);
        return;
    }

    // 3. Super admin (email o platformUsers.super_admin). Sigue pudiendo tener doc en schools/.../users
    // para usar el panel de escuela (jugadores, asistencia, etc.) como un admin de escuela.
    const superAdminByEmail = user.email === 'abengolea1@gmail.com';
    const superAdminByDB = platformUser?.super_admin === true;
    setIsSuperAdmin(superAdminByEmail || superAdminByDB);

    // Normalizar email a minúsculas: Firestore es case-sensitive y Auth puede devolver mayúsculas.
    const emailNorm = (user.email ?? '').trim().toLowerCase();
    if (!emailNorm) {
      setMemberships([]);
      setProfileLoading(false);
      return;
    }
    const userRolesQuery = query(
        collectionGroup(firestore, 'users'),
        where('email', '==', emailNorm)
    );

    getDocs(userRolesQuery).then(snapshot => {
      if (!snapshot.empty) {
        const userMemberships: FullSchoolMembership[] = snapshot.docs.map(doc => {
          const schoolId = doc.ref.parent.parent!.id;
          const schoolUserData = doc.data() as SchoolUser;
          return {
            schoolId: schoolId,
            role: schoolUserData.role,
            displayName: schoolUserData.displayName,
            email: schoolUserData.email,
          };
        });
        setMemberships(sortMembershipsByRole(userMemberships));
        setProfileLoading(false);
        return;
      }
      // 4. No membership in users: check playerLogins (email -> schoolId + playerId) para que el jugador inicie sesión.
      const loginRef = doc(firestore, 'playerLogins', emailNorm);
      getDoc(loginRef).then(loginSnap => {
        if (!loginSnap.exists()) {
          setMemberships([]);
          setProfileLoading(false);
          return;
        }
        const { schoolId, playerId } = loginSnap.data() as { schoolId: string; playerId: string };
        const playerRef = doc(firestore, `schools/${schoolId}/players/${playerId}`);
        getDoc(playerRef).then(playerSnap => {
          if (!playerSnap.exists()) {
            setMemberships([]);
          } else {
            const playerData = playerSnap.data() as { firstName?: string; lastName?: string; status?: string };
            if (playerData.status !== 'active') {
              setMemberships([]);
              setProfileLoading(false);
              return;
            }
            const displayName = ([playerData.firstName, playerData.lastName].filter(Boolean).join(' ') || user.email) ?? 'Jugador';
            setMemberships([{
              schoolId,
              role: 'player',
              displayName,
              email: user.email!,
              playerId,
            }]);
          }
          setProfileLoading(false);
        }).catch(() => {
          setMemberships([]);
          setProfileLoading(false);
        });
      }).catch((err: FirestoreError) => {
        console.error("Error fetching playerLogin by email:", err);
        setMemberships([]);
        setProfileLoading(false);
      });
    }).catch((error: FirestoreError) => {
        console.error("Error fetching user memberships:", error);
        setMemberships([]); // Set empty on error
        setProfileLoading(false);
    });

  }, [user, authLoading, firestore, platformUser]); // Rerun when auth state or the DB user profile changes

  const loading = authLoading || profileLoading;

  const profile: UserProfile | null = useMemo(() => {
    if (loading || !user) {
      return null;
    }

    // Super admin sin escuela vinculada: solo panel de plataforma.
    if (isSuperAdmin && (!memberships || memberships.length === 0)) {
      return {
        id: user.uid,
        uid: user.uid,
        displayName: user.displayName || user.email || 'Super Admin',
        email: user.email!,
        role: 'school_admin',
        isSuperAdmin: true,
        activeSchoolId: undefined,
        memberships: [],
      };
    }

    // Usuario normal (o super admin con doc en schools/.../users): requiere al menos una membresía.
    if (!memberships || memberships.length === 0) {
      return null;
    }

    const activeMembership = memberships[0];
    const { schoolId, playerId, ...schoolUserData } = activeMembership;

    return {
      ...schoolUserData,
      id: user.uid,
      uid: user.uid,
      isSuperAdmin: isSuperAdmin,
      activeSchoolId: schoolId,
      memberships: memberships,
      ...(playerId && { playerId }),
    };
  }, [loading, user, isSuperAdmin, memberships]);


  const isReady = !loading;

  return {
    user,
    profile,
    loading,
    isReady,
    activeSchoolId: profile?.activeSchoolId,
    isAdmin: isSuperAdmin || profile?.role === 'school_admin',
    isCoach: profile?.role === 'coach',
    isPlayer: profile?.role === 'player',
    isSuperAdmin: isSuperAdmin,
  };
}
