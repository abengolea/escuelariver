"use client";
import { Header } from "@/components/layout/Header";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { useUserProfile } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isReady, user } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    // If loading is done and there's no user, redirect to login
    if (isReady && !user) {
      router.push("/auth/login");
      return;
    }
    // If loading is done, there IS a user, but they have no profile (no roles),
    // redirect them to the pending page.
    // CRITICAL: We add an exception for the super admin email to prevent a race
    // condition where they are redirected before their profile is fully loaded.
    if (isReady && user && !profile && user.email !== 'abengolea1@gmail.com') {
      router.push("/auth/pending-approval");
    }
  }, [isReady, user, profile, router]);

  // Show loading screen while we check for user and profile.
  // Also add the exception for the super admin to avoid showing the loading screen
  // indefinitely if their profile is temporarily null during the race condition.
  if (!isReady || (!profile && user?.email !== 'abengolea1@gmail.com')) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarNav />
        </Sidebar>
        <SidebarInset className="bg-background">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 pt-6 md:p-8">
            {children}
          </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
