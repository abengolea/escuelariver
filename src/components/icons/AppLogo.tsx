"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

// This key should be consistent with the settings page
const LOGO_STORAGE_KEY = "app-logo-data-url";

/** Logo de la app. Usa logo personalizado de localStorage o fallback. */
export function AppLogo({ className }: { className?: string }) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    const updateLogoSrc = () => {
      const storedLogo = localStorage.getItem(LOGO_STORAGE_KEY);
      const isValidDataUrl =
        typeof storedLogo === "string" &&
        storedLogo.startsWith("data:") &&
        storedLogo.length > 100;
      setLogoSrc(isValidDataUrl ? storedLogo : null); // null = usar placeholder emoji
    };

    updateLogoSrc();

    const handleLogoUpdate = () => updateLogoSrc();
    window.addEventListener("logo-updated", handleLogoUpdate);
    window.addEventListener("storage", (e) => {
      if (e.key === LOGO_STORAGE_KEY) handleLogoUpdate();
    });

    return () => {
      window.removeEventListener("logo-updated", handleLogoUpdate);
      window.removeEventListener("storage", (e) => {
        if (e.key === LOGO_STORAGE_KEY) handleLogoUpdate();
      });
    };
  }, []);

  // Sin logo personalizado: mostrar placeholder con emoji de fútbol
  if (!logoSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg shrink-0",
          "h-10 w-10",
          className
        )}
        aria-label="Logo Escuelas River"
      >
        ⚽
      </div>
    );
  }

  const handleError = () => setLogoSrc(null);

  return (
    <Image
      key={logoSrc}
      src={logoSrc}
      alt="Escuelas River Logo"
      width={40}
      height={40}
      className={cn("h-10 w-10", className)}
      unoptimized={logoSrc.startsWith("data:")}
      onError={handleError}
    />
  );
}
