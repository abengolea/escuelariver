"use client";

import React from "react";
import { useUserProfile } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { SuperAdminDashboard } from "@/components/admin/SuperAdminDashboard";
import { SchoolAdminDashboard } from "@/components/admin/SchoolAdminDashboard";

export default function DashboardPage() {
  const { isReady, isSuperAdmin } = useUserProfile();

  if (!isReady) {
    return (
       <div className="flex flex-col gap-4">
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
  
  if (isSuperAdmin) {
      return <SuperAdminDashboard />;
  }

  return <SchoolAdminDashboard />;
}
