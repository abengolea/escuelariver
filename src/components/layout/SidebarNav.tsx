"use client";

import {
  Home,
  Users,
  Settings,
  Building,
  Shield,
  UserCheck,
  Video,
  ClipboardCheck,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { RiverPlateLogo } from "../icons/RiverPlateLogo";
import { useUserProfile, useCollection } from "@/firebase";
import type { PendingPlayer } from "@/lib/types";
import type { AccessRequest } from "@/lib/types";

const schoolUserMenuItems = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
  { href: "/dashboard/attendance", label: "Asistencia", icon: ClipboardCheck },
  { href: "/dashboard/record-video", label: "Grabar video", icon: Video },
  { href: "/dashboard/registrations", label: "Solicitudes", icon: UserCheck },
  { href: "/dashboard/physical-assessments-config", label: "Evaluaciones Físicas", icon: Activity },
];

const superAdminMenuItems = [
    { href: "/dashboard", label: "Escuelas", icon: Building },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { isSuperAdmin, isReady, profile, activeSchoolId, isPlayer } = useUserProfile();
  // Solo staff (admin/coach) puede listar pendingPlayers; un jugador no tiene permiso.
  const canListSchoolCollections = isReady && activeSchoolId && !isPlayer;

  const { data: pendingPlayers } = useCollection<PendingPlayer>(
    canListSchoolCollections ? `schools/${activeSchoolId}/pendingPlayers` : "",
    {}
  );
  const { data: accessRequests } = useCollection<AccessRequest>(
    isReady ? "accessRequests" : "",
    { where: ["status", "==", "pending"] }
  );
  const solicitudesCount = (pendingPlayers?.length ?? 0) + (accessRequests?.length ?? 0);

  let menuItems;

  if (isSuperAdmin) {
    menuItems = superAdminMenuItems;
  } else if (profile?.role === 'player' && profile.activeSchoolId && profile.playerId) {
    // Jugador: solo ve su perfil
    menuItems = [
      { href: "/dashboard", label: "Panel Principal", icon: Home },
      { href: `/dashboard/players/${profile.playerId}?schoolId=${profile.activeSchoolId}`, label: "Mi perfil", icon: Users },
    ];
  } else {
    // Start with the base items for any school user (coach / school_admin)
    menuItems = [...schoolUserMenuItems]; 
    // Add the management link ONLY for school admins
    if (profile?.role === 'school_admin' && profile.activeSchoolId) {
      menuItems.push({
        href: `/dashboard/schools/${profile.activeSchoolId}`,
        label: "Gestionar Escuela",
        icon: Shield
      });
    }
  }

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 p-2">
          <RiverPlateLogo className="h-8 w-8" />
          <span className="text-xl font-bold font-headline uppercase">
            <span className="text-red-600">ESCUELAS</span>{" "}
            <span className="text-black dark:text-white">RIVER</span>{" "}
            <span className="text-red-600">SN</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        {!isReady ? (
            <div className="flex flex-col gap-2 pt-2">
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSkeleton showIcon />
            </div>
        ) : (
            <SidebarMenu>
            {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                <Link href={item.href} className="relative flex items-center">
                    <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                    tooltip={item.label}
                    className="font-headline w-full"
                    >
                    <item.icon />
                    <span>{item.label}</span>
                    {item.href === "/dashboard/registrations" && solicitudesCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs">
                        {solicitudesCount > 99 ? "99+" : solicitudesCount}
                      </Badge>
                    )}
                    </SidebarMenuButton>
                </Link>
                </SidebarMenuItem>
            ))}
            </SidebarMenu>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard/settings">
              <SidebarMenuButton
                isActive={pathname.startsWith("/dashboard/settings")}
                tooltip="Ajustes"
                className="font-headline"
              >
                <Settings />
                <span>Ajustes</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
