"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Mail,
  MessageCircle,
  Headphones,
  Banknote,
  FileText,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { RiverPlateLogo } from "../icons/RiverPlateLogo";
import { useUserProfile, useCollection, useDoc, useFirebase } from "@/firebase";
import { isPlayerProfileComplete } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { getAuth } from "firebase/auth";
import type { PendingPlayer } from "@/lib/types";
import type { AccessRequest } from "@/lib/types";

const schoolUserMenuItems = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
  { href: "/dashboard/attendance", label: "Asistencia", icon: ClipboardCheck },
  { href: "/dashboard/record-video", label: "Videoteca", icon: Video },
  { href: "/dashboard/registrations", label: "Solicitudes", icon: UserCheck },
  { href: "/dashboard/physical-assessments-config", label: "Evaluaciones Físicas", icon: Activity },
  { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle },
];

const superAdminMenuItems = [
    { href: "/dashboard", label: "Escuelas", icon: Building },
    { href: "/dashboard/support/operator", label: "Tickets de Soporte", icon: Headphones },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { app } = useFirebase();
  const { isSuperAdmin, isReady, profile, activeSchoolId, isPlayer } = useUserProfile();
  const [hasPaymentOverdue, setHasPaymentOverdue] = useState(false);
  const playerPath = profile?.role === "player" && profile?.activeSchoolId && profile?.playerId
    ? `schools/${profile.activeSchoolId}/players/${profile.playerId}`
    : "";
  const { data: player } = useDoc<Player>(playerPath);
  const playerProfileComplete = !player || isPlayerProfileComplete(player);

  const fetchPaymentOverdue = useCallback(async () => {
    if (!isPlayer || !app) return;
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken().catch(() => null);
    if (!token) return;
    const res = await fetch("/api/payments/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setHasPaymentOverdue(Boolean(data.hasOverdue));
  }, [isPlayer, app]);

  useEffect(() => {
    if (isReady && isPlayer) fetchPaymentOverdue();
  }, [isReady, isPlayer, fetchPaymentOverdue]);

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);
  // Solo staff (school_admin o coach) puede listar pendingPlayers; nunca listar si es jugador.
  const isStaff = profile?.role === "school_admin" || profile?.role === "coach";
  const canListSchoolCollections = isReady && activeSchoolId && isStaff;

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
    // Jugador: si perfil incompleto "Mi perfil" + "Pagos"; si completo, panel, perfil, pagos y soporte
    const profileHref = `/dashboard/players/${profile.playerId}?schoolId=${profile.activeSchoolId}`;
    if (!playerProfileComplete) {
      const tab = (t: string) => `${profileHref}&tab=${t}`;
      menuItems = [
        { href: profileHref, label: "Mi perfil", icon: Users },
        { href: tab("attendance"), label: "Asistencia", icon: ClipboardCheck },
        { href: tab("evaluations"), label: "Evaluaciones deportivas", icon: FileText },
        { href: tab("physical"), label: "Evaluaciones físicas", icon: Activity },
        { href: tab("videoteca"), label: "Videoteca", icon: Video },
        { href: "/dashboard/payments", label: "Pago de cuotas", icon: Banknote, badgeOverdue: true },
      ];
    } else {
      const tab = (t: string) => `${profileHref}&tab=${t}`;
      menuItems = [
        { href: "/dashboard", label: "Panel Principal", icon: Home },
        { href: profileHref, label: "Mi perfil", icon: Users },
        { href: tab("videoteca"), label: "Videoteca", icon: Video },
        { href: "/dashboard/payments", label: "Pago de cuotas", icon: Banknote, badgeOverdue: true },
        { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle },
      ];
    }
  } else {
    // Start with the base items for any school user (coach / school_admin)
    menuItems = [...schoolUserMenuItems]; 
    // Add management and messages ONLY for school admins
    if (profile?.role === 'school_admin' && profile.activeSchoolId) {
      menuItems.push(
        { href: "/dashboard/payments", label: "Pagos", icon: Banknote },
        { href: "/dashboard/messages", label: "Mensajes", icon: Mail },
        {
          href: `/dashboard/schools/${profile.activeSchoolId}`,
          label: "Gestionar Escuela",
          icon: Shield
        }
      );
    }
  }

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 p-2" onClick={closeMobileSidebar}>
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
                <SidebarMenuItem key={`${item.href}-${item.label}`}>
                <Link href={item.href} className="relative flex items-center" onClick={closeMobileSidebar}>
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
                    {"badgeOverdue" in item && item.badgeOverdue && hasPaymentOverdue && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs" title="Cuota vencida">
                        !
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
            <Link href="/dashboard/settings" onClick={closeMobileSidebar}>
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
