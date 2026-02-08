"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

// This key should be consistent with the settings page
const LOGO_STORAGE_KEY = "app-logo-data-url";
const FALLBACK_LOGO_SRC = "/river-plate-logo.png"; // A default that will 404 if not in /public, but provides a path

export function RiverPlateLogo({ className }: { className?: string }) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    // This function runs only on the client, after hydration
    const updateLogoSrc = () => {
      const storedLogo = localStorage.getItem(LOGO_STORAGE_KEY);
      setLogoSrc(storedLogo || FALLBACK_LOGO_SRC);
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

  return (
    <Image
      // Using a key helps React re-render the image when the src changes
      key={logoSrc}
      src={logoSrc}
      alt="Escuela River San Nicolás Logo"
      width={40}
      height={40}
      className={cn("h-10 w-10", className)}
      // This is crucial for next/image with data URIs
      unoptimized={logoSrc.startsWith("data:")}
    />
  );
}
