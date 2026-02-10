"use client";
import { Header } from "@/components/layout/Header";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { useUserProfile, useDoc } from "@/firebase";
import { isPlayerProfileComplete } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isReady, user } = useUserProfile();
  const router = useRouter();
  const pathname = usePathname();
  const playerPath = profile?.role === "player" && profile?.activeSchoolId && profile?.playerId
    ? `schools/${profile.activeSchoolId}/players/${profile.playerId}`
    : "";
  const { data: player } = useDoc<Player>(playerPath);

  useEffect(() => {
    // This effect handles redirects once the profile status is determined.
    if (!isReady) return; // Wait until the profile is fully loaded

    if (!user) {
      // If there's no user at all, go to login.
      router.push("/auth/login");
    } else if (!profile) {
      // If there's a user but no profile (meaning no roles found),
      // they need to wait for an admin to assign them.
      router.push("/auth/pending-approval");
    }
  }, [isReady, user, profile, router]);

  // Jugador con perfil incompleto: solo puede estar en su página de perfil o en Pagos.
  useEffect(() => {
    if (!isReady || !profile || profile.role !== "player" || !profile.activeSchoolId || !profile.playerId) return;
    if (!player) return; // Esperar a que cargue el jugador
    if (isPlayerProfileComplete(player)) return;
    const profilePath = `/dashboard/players/${profile.playerId}`;
    const isOnProfilePage = pathname === profilePath || pathname?.startsWith(profilePath + "/");
    const isOnPaymentsPage = pathname === "/dashboard/payments";
    if (!isOnProfilePage && !isOnPaymentsPage) {
      router.replace(`${profilePath}?schoolId=${profile.activeSchoolId}`);
    }
  }, [isReady, profile, player, pathname, router]);

  // Render a loading state until the profile is ready.
  // This prevents any child components from rendering with incomplete auth data.
  if (!isReady || !profile) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  // If a profile exists, the user is authorized to see the dashboard layout.
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
