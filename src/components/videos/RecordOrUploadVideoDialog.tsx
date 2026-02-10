"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doc, getDoc } from "firebase/firestore";
import { useStorage, useFirestore } from "@/firebase/provider";
import { useUser, useCollection } from "@/firebase";
import type { Player } from "@/lib/types";
import { uploadPlayerVideoWithProgress } from "@/lib/player-videos";
import { buildEmailHtml, escapeHtml, htmlToPlainText, sendMailDoc } from "@/lib/email";
import { useToast } from "@/hooks/use-toast";
import { Video, Upload, Loader2, Circle, Square } from "lucide-react";
import {
  VIDEO_SKILLS_GENERAL,
  VIDEO_SKILLS_GOALKEEPER,
} from "@/lib/video-skills";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RecordOrUploadVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  initialPlayerId: string | null;
  initialPlayerName: string;
  /** Si true, no mostrar selector de jugador (estamos en la página del jugador) */
  embedded?: boolean;
  onSuccess?: () => void;
}

type Mode = "record" | "upload";

export function RecordOrUploadVideoDialog({
  open,
  onOpenChange,
  schoolId,
  initialPlayerId,
  initialPlayerName,
  embedded = true,
  onSuccess,
}: RecordOrUploadVideoDialogProps) {
  const { user } = useUser();
  const storage = useStorage();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("upload");
  const [playerId, setPlayerId] = useState<string>(initialPlayerId ?? "");
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: players } = useCollection<Player>(
    schoolId && !embedded ? `schools/${schoolId}/players` : ""
  );

  const effectivePlayerId = embedded ? initialPlayerId : playerId;
  const canSubmit =
    effectivePlayerId &&
    user &&
    (mode === "upload" ? file : recordedBlob) &&
    !uploading;

  const toggleSkill = (id: string) => {
    setSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setSelectedSkills([]);
    setFile(null);
    setRecordedBlob(null);
    setUploadProgress(0);
    setUploading(false);
    setRecording(false);
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = async () => {
    try {
      // En móvil: preferir cámara trasera (environment) para grabar la escena, no la selfie
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }
      streamRef.current = stream;
      chunksRef.current = [];

      // Mostrar vista previa en vivo para no ver pantalla negra
      const videoEl = videoPreviewRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.muted = true; // necesario para autoplay en móvil
        await videoEl.play().catch(() => {});
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
      };
      recorder.start(1000);
      setRecording(true);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al acceder a la cámara",
        description: "Comprueba que el navegador tenga permiso para cámara y micrófono.",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setRecording(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("video/")) {
      setFile(f);
      setRecordedBlob(null);
    } else if (f) {
      toast({
        variant: "destructive",
        title: "Archivo no válido",
        description: "Selecciona un archivo de video (MP4, WebM, etc.).",
      });
    }
  };

  const handleSubmit = async () => {
    if (!effectivePlayerId || !user) return;
    let videoFile: File;
    if (mode === "upload" && file) {
      videoFile = file;
    } else if (mode === "record" && recordedBlob) {
      videoFile = new File([recordedBlob], "grabacion.webm", {
        type: recordedBlob.type || "video/webm",
      });
    } else return;

    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadPlayerVideoWithProgress(
        {
          storage,
          firestore,
          userId: user.uid,
          schoolId,
          playerId: effectivePlayerId,
          file: videoFile,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        },
        (percent) => setUploadProgress(percent)
      );
      toast({
        title: "Video subido",
        description: "Se añadió a la videoteca del jugador.",
      });
      // Notificar por mail al jugador si tiene email
      try {
        const playerRef = doc(firestore, `schools/${schoolId}/players/${effectivePlayerId}`);
        const playerSnap = await getDoc(playerRef);
        const playerData = playerSnap.data();
        const playerEmail = playerData?.email?.trim?.();
        const firstName = playerData?.firstName ?? (playerName?.trim() || "jugador");
        if (playerEmail) {
          const subject = "Nuevo video en tu videoteca - Escuelas River SN";
          const contentHtml = `<p>Hola <strong>${escapeHtml(firstName)}</strong>,</p><p>Tu entrenador subió un nuevo video a tu videoteca. Entrá al panel para verlo.</p><p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/dashboard" style="color: #d4002a; font-weight: bold;">Ver mi videoteca</a></p>`;
          const html = buildEmailHtml(contentHtml, {
            title: "Escuelas River SN",
            greeting: "Tenés un nuevo video en tu perfil.",
            baseUrl: typeof window !== "undefined" ? window.location.origin : "",
          });
          await sendMailDoc(firestore, { to: playerEmail, subject, html, text: htmlToPlainText(contentHtml) });
        }
      } catch {
        // No bloquear si falla el envío del mail
      }
      resetForm();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: err instanceof Error ? err.message : "No se pudo subir el video.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">Grabar o subir video</DialogTitle>
        </DialogHeader>

        {!embedded && (
          <div className="space-y-2">
            <Label>Jugador</Label>
            <Select
              value={playerId}
              onValueChange={(id) => {
                setPlayerId(id);
                const p = players?.find((x) => x.id === id);
                setPlayerName(p ? `${p.firstName} ${p.lastName}`.trim() : "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elige un jugador" />
              </SelectTrigger>
              <SelectContent>
                {players?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 border rounded-lg p-1">
          <Button
            type="button"
            variant={mode === "upload" ? "ghost" : "secondary"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setMode("upload");
              setFile(null);
              setRecordedBlob(null);
              // Abrir el explorador de archivos al elegir "Subir archivo" (tras el re-render)
              setTimeout(() => fileInputRef.current?.click(), 50);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir archivo
          </Button>
          <Button
            type="button"
            variant={mode === "record" ? "ghost" : "secondary"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setMode("record");
              setFile(null);
              setRecordedBlob(null);
            }}
          >
            <Video className="mr-2 h-4 w-4" />
            Grabar
          </Button>
        </div>

        {mode === "upload" && (
          <div className="space-y-2">
            <Label>Video (MP4, WebM, etc.)</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="cursor-pointer"
            />
            {file && (
              <p className="text-sm text-muted-foreground truncate">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        )}

        {mode === "record" && (
          <div className="space-y-2">
            <Label>Grabación</Label>
            <div className="aspect-video bg-black rounded-lg flex items-center justify-center overflow-hidden relative">
              {recordedBlob ? (
                <video
                  src={URL.createObjectURL(recordedBlob)}
                  controls
                  className="max-h-full max-w-full w-full h-full object-cover"
                  playsInline
                />
              ) : (
                <>
                  {/* Siempre montado para que el ref exista al iniciar grabación y se vea la vista previa */}
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className={
                      recording
                        ? "absolute inset-0 w-full h-full object-cover"
                        : "absolute inset-0 w-full h-full object-cover pointer-events-none opacity-0"
                    }
                  />
                  {recording ? (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full">
                      <span className="flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                      Grabando...
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm relative z-10">
                      Inicia la grabación para previsualizar
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {!recording && !recordedBlob && (
                <Button type="button" onClick={startRecording} disabled={uploading}>
                  <Circle className="mr-2 h-4 w-4 fill-red-500 text-red-500" />
                  Iniciar grabación
                </Button>
              )}
              {recording && (
                <Button type="button" variant="destructive" onClick={stopRecording}>
                  <Square className="mr-2 h-4 w-4" />
                  Detener
                </Button>
              )}
              {recordedBlob && !recording && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRecordedBlob(null);
                    chunksRef.current = [];
                  }}
                >
                  Volver a grabar
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Habilidades (opcional)</Label>
          <ScrollArea className="h-[140px] rounded-md border p-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Generales</p>
                <div className="flex flex-wrap gap-1.5">
                  {VIDEO_SKILLS_GENERAL.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant={selectedSkills.includes(s.id) ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleSkill(s.id)}
                      disabled={uploading}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Arquero</p>
                <div className="flex flex-wrap gap-1.5">
                  {VIDEO_SKILLS_GOALKEEPER.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant={selectedSkills.includes(s.id) ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleSkill(s.id)}
                      disabled={uploading}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Título (opcional)</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Control de balón, Entrenamiento 08/02"
            disabled={uploading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Notas (opcional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Comentarios del entrenador"
            rows={2}
            disabled={uploading}
          />
        </div>

        {uploading && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Subiendo...</p>
            <Progress value={uploadProgress} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              "Subir a videoteca"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
