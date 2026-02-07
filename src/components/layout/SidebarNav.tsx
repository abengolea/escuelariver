"use client";

import {
  Home,
  Users,
  Calendar,
  HeartPulse,
  FileText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { RiverPlateLogo } from "../icons/RiverPlateLogo";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/players", label: "Players", icon: Users },
  { href: "/dashboard/sessions", label: "Sessions", icon: Calendar },
  { href: "/dashboard/medical", label: "Medical", icon: HeartPulse },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <RiverPlateLogo className="h-8 w-8" />
          <span className="text-xl font-bold font-headline text-primary">Escuela de River</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard/settings" legacyBehavior passHref>
              <SidebarMenuButton
                isActive={pathname.startsWith("/dashboard/settings")}
                tooltip="Settings"
                className="font-headline"
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
