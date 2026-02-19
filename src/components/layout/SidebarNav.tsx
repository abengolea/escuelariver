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
  FileHeart,
  Sliders,
  History,
  UserX,
  Building2,
  Newspaper,
  Dumbbell,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { isMedicalRecordApproved } from "@/lib/utils";
import { getAuth } from "firebase/auth";
// Orden por importancia: núcleo operativo → seguimiento → comunicación → administración
const schoolUserMenuItems = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
  { href: "/dashboard/attendance", label: "Asistencia", icon: ClipboardCheck },
  { href: "/dashboard/training-schedules", label: "Entrenamientos", icon: Dumbbell },
  { href: "/dashboard/medical-records", label: "Fichas médicas", icon: FileHeart },
  { href: "/dashboard/registrations", label: "Solicitudes", icon: UserCheck },
  { href: "/dashboard/physical-assessments-config", label: "Evaluaciones Físicas", icon: Activity },
  { href: "/dashboard/record-video", label: "Videoteca", icon: Video },
  { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle },
  { href: "/dashboard/notas", label: "Notas", icon: Newspaper },
];

const superAdminMenuItems = [
    { href: "/dashboard", label: "Escuelas", icon: Building },
    { href: "/dashboard/admin/mensualidades", label: "Mensualidades", icon: Banknote },
    { href: "/dashboard/admin/physical-template", label: "Evaluaciones físicas (plantilla)", icon: Activity },
    { href: "/dashboard/support/operator", label: "Tickets de Soporte", icon: Headphones },
    { href: "/dashboard/admin/config", label: "Configuración global", icon: Sliders },
    { href: "/dashboard/admin/test-email", label: "Probar Trigger Email", icon: Mail },
    { href: "/dashboard/admin/audit", label: "Auditoría", icon: History },
    { href: "/dashboard/admin/delete-test-users", label: "Borrar usuarios de prueba", icon: UserX },
    { href: "/dashboard/notas", label: "Notas", icon: Newspaper },
];


export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const { data: allPlayers } = useCollection<Player>(
    canListSchoolCollections ? `schools/${activeSchoolId}/players` : "",
    {}
  );
  const medicalRecordsPendingCount = React.useMemo(() => {
    if (!allPlayers?.length) return 0;
    return allPlayers.filter(
      (p) => !p.archived && (!p.medicalRecord?.url || !isMedicalRecordApproved(p))
    ).length;
  }, [allPlayers]);

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
        { href: "/dashboard/payments", label: "Mis pagos", icon: Banknote, badgeOverdue: true },
      ];
    } else {
      const tab = (t: string) => `${profileHref}&tab=${t}`;
      menuItems = [
        { href: "/dashboard", label: "Panel Principal", icon: Home },
        { href: profileHref, label: "Mi perfil", icon: Users },
        { href: tab("videoteca"), label: "Videoteca", icon: Video },
        { href: "/dashboard/payments", label: "Mis pagos", icon: Banknote, badgeOverdue: true },
        { href: "/dashboard/support", label: "Centro de Soporte", icon: MessageCircle },
      ];
    }
  } else {
    // Start with the base items for any school user (coach / school_admin)
    menuItems = [...schoolUserMenuItems];
    // Add Pagos, Mensajes y Gestionar Escuela solo para school_admin, en orden de importancia
    if (profile?.role === 'school_admin' && profile.activeSchoolId) {
      const pagos = { href: "/dashboard/payments", label: "Pagos", icon: Banknote };
      const mensualidades = { href: "/dashboard/payments?tab=mensualidad", label: "Mensualidades", icon: Building2 };
      const mensajes = { href: "/dashboard/messages", label: "Mensajes", icon: Mail };
      const gestionarEscuela = {
        href: `/dashboard/schools/${profile.activeSchoolId}`,
        label: "Gestionar Escuela",
        icon: Shield
      };
      const notas = { href: "/dashboard/notas", label: "Notas", icon: Newspaper };
      const afterAttendance = 3;
      const baseWithoutNotas = menuItems.filter((i) => i.href !== "/dashboard/notas");
      menuItems = [
        ...baseWithoutNotas.slice(0, afterAttendance),
        pagos,
        mensualidades,
        ...baseWithoutNotas.slice(afterAttendance),
        mensajes,
        gestionarEscuela,
        notas
      ];
    }
  }

  // Evitar ítems duplicados por href (claves únicas y menú sin duplicados)
  const uniqueMenuItems = Array.from(
    new Map(menuItems.map((item) => [item.href, item])).values()
  );

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
            {uniqueMenuItems.map((item) => (
                <SidebarMenuItem key={`${item.href}-${item.label}`}>
                <Link href={item.href} className="relative flex items-center" onClick={closeMobileSidebar}>
                    <SidebarMenuButton
                    isActive={
                      item.href.includes("tab=mensualidad")
                        ? pathname === "/dashboard/payments" && searchParams.get("tab") === "mensualidad"
                        : item.href === "/dashboard/payments"
                          ? pathname === "/dashboard/payments" && searchParams.get("tab") !== "mensualidad"
                          : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href.split("?")[0]))
                    }
                    tooltip={item.label}
                    className="font-headline w-full"
                    >
                    <item.icon />
                    <span>{item.label}</span>
                    {item.href === "/dashboard/medical-records" && medicalRecordsPendingCount > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs" title="Fichas pendientes">
                        {medicalRecordsPendingCount > 99 ? "99+" : medicalRecordsPendingCount}
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
