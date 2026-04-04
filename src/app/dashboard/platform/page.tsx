"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminDashboard } from "@/components/admin/SuperAdminDashboard";
import { useUserProfile } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformDashboardPage() {
  const { isReady, isSuperAdmin } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isReady, isSuperAdmin, router]);

  if (!isReady) {
    return (
      <div className="flex flex-col gap-4 min-w-0">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return <SuperAdminDashboard />;
}
