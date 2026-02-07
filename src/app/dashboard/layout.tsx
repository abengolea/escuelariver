"use client";
import { Header } from "@/components/layout/Header";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
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
