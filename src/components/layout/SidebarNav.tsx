"use client";

import {
  Home,
  Users,
  Settings,
  Building,
  Shield,
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
import { RiverPlateLogo } from "../icons/RiverPlateLogo";
import { useUserProfile } from "@/firebase";

const schoolUserMenuItems = [
  { href: "/dashboard", label: "Panel Principal", icon: Home },
  { href: "/dashboard/players", label: "Jugadores", icon: Users },
];

const superAdminMenuItems = [
    { href: "/dashboard", label: "Escuelas", icon: Building },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { isSuperAdmin, isReady, profile } = useUserProfile();

  let menuItems;

  if (isSuperAdmin) {
    menuItems = superAdminMenuItems;
  } else {
    // Start with the base items for any school user
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
          <span className="text-xl font-bold font-headline text-primary">Escuela River SN</span>
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
                <Link href={item.href}>
                    <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                    tooltip={item.label}
                    className="font-headline"
                    >
                    <item.icon />
                    <span>{item.label}</span>
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
