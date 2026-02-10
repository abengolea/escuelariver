"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

// This key should be consistent with the settings page
const LOGO_STORAGE_KEY = "app-logo-data-url";
const FALLBACK_LOGO_SRC = "/LogoRiverNuevo_1_2.png"; // Logo en public/LogoRiverNuevo_1_2.png

export function RiverPlateLogo({ className }: { className?: string }) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    // This function runs only on the client, after hydration
    const updateLogoSrc = () => {
      const storedLogo = localStorage.getItem(LOGO_STORAGE_KEY);
      // Usar fallback si no hay logo guardado o si el valor no parece una data URL válida
      const isValidDataUrl =
        typeof storedLogo === "string" &&
        storedLogo.startsWith("data:") &&
        storedLogo.length > 100;
      setLogoSrc(isValidDataUrl ? storedLogo : FALLBACK_LOGO_SRC);
    };

    updateLogoSrc(); // Set initial logo

    const handleLogoUpdate = () => {
      updateLogoSrc();
    };

    // Listen for custom event from settings page
    window.addEventListener("logo-updated", handleLogoUpdate);
    // Also listen for storage changes from other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === LOGO_STORAGE_KEY) {
        handleLogoUpdate();
      }
    });

    return () => {
      window.removeEventListener("logo-updated", handleLogoUpdate);
      window.removeEventListener("storage", (e) => {
        if (e.key === LOGO_STORAGE_KEY) {
          handleLogoUpdate();
        }
      });
    };
  }, []);

  if (!logoSrc) {
    // During SSR and initial client render, show a placeholder
    return <div className={cn("h-10 w-10 bg-muted rounded-full", className)} />;
  }

  const handleError = () => {
    // Si la imagen falla (ej. data URL corrupta, 404), usar el logo de public (solo si no es ya el fallback)
    if (logoSrc !== FALLBACK_LOGO_SRC) {
      setLogoSrc(FALLBACK_LOGO_SRC);
    }
  };

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
