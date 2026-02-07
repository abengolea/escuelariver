"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

const LOGO_STORAGE_KEY = "app-logo-data-url";

export default function SettingsPage() {
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        // 1MB limit
        toast({
          variant: "destructive",
          title: "Archivo demasiado grande",
          description: "Por favor, sube una imagen de menos de 1MB.",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (preview) {
      localStorage.setItem(LOGO_STORAGE_KEY, preview);
      toast({
        title: "Logo guardado",
        description:
          "El nuevo logo se ha guardado. El cambio se verá reflejado en toda la aplicación.",
      });
      // Trigger a custom event to notify other components, like the logo component
      window.dispatchEvent(new Event("logo-updated"));
    } else {
      toast({
        variant: "destructive",
        title: "No hay logo para guardar",
        description: "Por favor, selecciona una imagen primero.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight font-headline">
        Ajustes
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>
            Personaliza la apariencia de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="logo-upload">Subir Logo</Label>
            <Input
              id="logo-upload"
              type="file"
              accept="image/png, image/jpeg, image/svg+xml"
              onChange={handleFileChange}
            />
            <p className="text-sm text-muted-foreground">
              Sube el logo de tu club. Recomendado: .png o .svg de menos de
              1MB.
            </p>
          </div>
          {preview && (
            <div className="space-y-2">
              <Label>Vista Previa</Label>
              <div className="flex items-center gap-4">
                <img
                  src={preview}
                  alt="Logo preview"
                  className="h-16 w-16 object-contain rounded-md border p-1"
                />
                <Button onClick={handleSave}>
                  <Upload className="mr-2 h-4 w-4" />
                  Guardar Logo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
