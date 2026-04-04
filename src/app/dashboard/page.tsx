"use client";

import React, { useEffect } from "react";
import { useUserProfile } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { SuperAdminDashboard } from "@/components/admin/SuperAdminDashboard";
import { SchoolAdminDashboard } from "@/components/admin/SchoolAdminDashboard";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { isReady, isSuperAdmin, profile } = useUserProfile();
  const router = useRouter();

  const isPlayer = profile?.role === "player" && profile.activeSchoolId && profile.playerId;

  useEffect(() => {
    if (isReady && isPlayer) {
      router.replace(`/dashboard/players/${profile!.playerId!}?schoolId=${profile!.activeSchoolId!}`);
    }
  }, [isReady, isPlayer, profile?.playerId, profile?.activeSchoolId, router]);

  if (!isReady) {
    return (
       <div className="flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between space-y-2">
            <Skeleton className="h-10 w-1/3" />
        </div>
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
         </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Skeleton className="col-span-4 h-64 w-full" />
            <Skeleton className="col-span-3 h-64 w-full" />
          </div>
       </div>
    );
  }

  if (isPlayer) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Skeleton className="h-10 w-1/3" />
      </div>
    );
  }
  
  if (isSuperAdmin && !profile?.activeSchoolId) {
    return <SuperAdminDashboard />;
  }

  return <SchoolAdminDashboard />;
}
