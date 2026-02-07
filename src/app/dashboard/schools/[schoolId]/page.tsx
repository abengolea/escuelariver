"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDoc, useUserProfile } from "@/firebase";
import type { School } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SchoolUsersList } from "@/components/admin/SchoolUsersList";
import { useEffect } from "react";

export default function SchoolAdminPage() {
  const params = useParams();
  const router = useRouter();
  const schoolId = params.schoolId as string;
  const { isSuperAdmin, isReady: profileReady } = useUserProfile();

  const { data: school, loading: schoolLoading } = useDoc<School>(`schools/${schoolId}`);

  // Redirect if user is not a super admin and loading is done
  useEffect(() => {
    if (profileReady && !isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [profileReady, isSuperAdmin, router]);


  const isLoading = schoolLoading || !profileReady;

  // Don't render the component if the user is not a super admin
  // This prevents flashing the content before redirecting
  if (profileReady && !isSuperAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Volver al panel</span>
          </Link>
        </Button>
        {isLoading ? (
            <Skeleton className="h-8 w-1/3" />
        ) : (
            <h1 className="text-3xl font-bold tracking-tight font-headline">
                Gestión de: {school?.name}
            </h1>
        )}
      </div>
      
      {isLoading ? (
        <Card>
            <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-40 w-full" /></CardContent>
        </Card>
      ) : !school ? (
        <Card>
            <CardHeader>
                <CardTitle>Escuela no encontrada</CardTitle>
                <CardDescription>La escuela que buscas no existe o fue eliminada.</CardDescription>
            </CardHeader>
        </Card>
      ) : (
        <>
            <SchoolUsersList schoolId={schoolId} />
        </>
      )}
    </div>
  );
}
