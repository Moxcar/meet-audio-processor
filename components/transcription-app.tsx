"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Intervention {
  id: string;
  participant: { name: string; id: number };
  text: string;
  timestamp: string;
  isPartial?: boolean;
}

interface BotTemplate {
  id: string;
  name: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  bot_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function TranscriptionApp() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentBotId, setCurrentBotId] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [botName, setBotName] = useState("Transcription Bot");
  const [transcriptionType, setTranscriptionType] =
    useState("meeting_captions");
  const [botPhoto, setBotPhoto] = useState<File | null>(null);
  const [botPhotoPreview, setBotPhotoPreview] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [sendingToN8n, setSendingToN8n] = useState(false);
  const transcriptionAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
      toast({
        title: "Conectado",
        description: "Conectado al servidor",
      });
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
      setShowAudioPanel(false);
      toast({
        title: "Desconectado",
        description: "Desconectado del servidor",
        variant: "destructive",
      });
    });

    newSocket.on("bot-created", (data: any) => {
      console.log("Bot created:", data);
      setCurrentBotId(data.botId);
      toast({
        title: "Bot creado",
        description: "Bot creado exitosamente. Esperando conexión...",
      });
    });

    newSocket.on("bot-error", (data: any) => {
      console.error("Bot error:", data);
      toast({
        title: "Error",
        description: data.message || "Error al crear el bot",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    newSocket.on("bot-status", (data: any) => {
      console.log("Bot status:", data);
      if (data.status === "in_call") {
        setIsConnected(true);
        setShowAudioPanel(true);
        toast({
          title: "Bot conectado",
          description: "Bot conectado a la reunión. Transcripción iniciada.",
        });
      } else if (data.status === "call_ended") {
        setIsConnected(false);
        setShowAudioPanel(false);
        toast({
          title: "Llamada finalizada",
          description: "La llamada ha finalizado",
        });
      }
    });

    newSocket.on("transcription", (data: any) => {
      console.log("Transcription received:", data);
      handleTranscription(data);
    });

    return () => {
      newSocket.close();
    };
  }, [toast]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && transcriptionAreaRef.current) {
      transcriptionAreaRef.current.scrollTop =
        transcriptionAreaRef.current.scrollHeight;
    }
  }, [interventions, autoScroll]);

  const loadTemplates = async () => {
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === "none") {
      setSelectedTemplateId("");
      return;
    }
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setBotName(template.bot_name);
        setLanguage(template.language);
        setTranscriptionType(template.transcription_type);
        if (template.bot_photo_url) {
          setBotPhotoPreview(template.bot_photo_url);
          // Convert base64 to File if needed
          fetch(template.bot_photo_url)
            .then((res) => res.blob())
            .then((blob) => {
              const file = new File([blob], "bot-photo.jpg", {
                type: "image/jpeg",
              });
              setBotPhoto(file);
            })
            .catch((error) => {
              console.error("Failed to load template image:", error);
            });
        } else {
          setBotPhotoPreview(null);
          setBotPhoto(null);
        }
        toast({
          title: "Plantilla cargada",
          description: `Configuración de "${template.name}" aplicada`,
        });
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un nombre para la plantilla",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          bot_name: botName,
          transcription_type: transcriptionType,
          language: language,
          bot_photo_url: botPhotoPreview,
        }),
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Plantilla guardada correctamente",
        });
        setShowSaveTemplateDialog(false);
        setTemplateName("");
        loadTemplates();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar plantilla",
        variant: "destructive",
      });
    }
  };

  const handleTranscription = (data: any) => {
    if (
      data.type === "transcript.data" ||
      data.type === "transcript.partial_data"
    ) {
      const transcriptData = data.data || data.transcript;

      if (Array.isArray(transcriptData)) {
        // Meeting captions format
        transcriptData.forEach((item: any) => {
          addIntervention({
            participant: { name: item.speaker || "Speaker", id: 0 },
            text: item.text || "",
            timestamp: item.timestamp || new Date().toISOString(),
            isPartial: data.type === "transcript.partial_data",
          });
        });
      } else if (transcriptData.participant && transcriptData.words) {
        // Deepgram format
        const words = transcriptData.words.map((w: any) => w.text).join(" ");
        addIntervention({
          participant: transcriptData.participant,
          text: words,
          timestamp:
            transcriptData.words[0]?.start_timestamp?.absolute ||
            new Date().toISOString(),
          isPartial: data.type === "transcript.partial_data",
        });
      }
    }
  };

  const addIntervention = (intervention: Omit<Intervention, "id">) => {
    setInterventions((prev) => {
      const newId = Date.now().toString();
      // If last intervention is partial and same participant, update it
      const last = prev[prev.length - 1];
      if (
        last?.isPartial &&
        last.participant.id === intervention.participant.id
      ) {
        return [...prev.slice(0, -1), { ...intervention, id: last.id }];
      }
      return [...prev, { ...intervention, id: newId }];
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        !file.type.startsWith("image/jpeg") &&
        !file.type.startsWith("image/jpg")
      ) {
        toast({
          title: "Error",
          description: "Por favor selecciona solo archivos JPEG",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "El archivo es demasiado grande. Máximo 5MB",
          variant: "destructive",
        });
        return;
      }
      setBotPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setBotPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConnect = async () => {
    if (!meetingUrl.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa una URL de Google Meet",
        variant: "destructive",
      });
      return;
    }

    if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i.test(meetingUrl)) {
      toast({
        title: "Error",
        description: "Por favor ingresa una URL válida de Google Meet",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("meetingUrl", meetingUrl);
      formData.append("language", language);
      formData.append("botName", botName);
      formData.append("transcriptionType", transcriptionType);
      if (selectedTemplateId) {
        formData.append("templateId", selectedTemplateId);
      }
      if (botPhoto) {
        formData.append("botPhoto", botPhoto);
      }
      if (socket?.id) {
        formData.append("socketId", socket.id);
      }

      const response = await fetch("/api/bot/create-with-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setCurrentBotId(data.botId);
        toast({
          title: "Bot creado",
          description: "Bot creado exitosamente. Esperando conexión...",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al crear el bot",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAudio = async () => {
    if (!audioFile || !currentBotId) return;

    try {
      const formData = new FormData();
      formData.append("audioFile", audioFile);

      const response = await fetch(`/api/bot/${currentBotId}/output-audio`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Audio enviado",
          description: "Audio enviado al bot exitosamente",
        });
        setAudioFile(null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al enviar audio",
        variant: "destructive",
      });
    }
  };

  const clearTranscription = () => {
    setInterventions([]);
    toast({
      title: "Transcripción limpiada",
      description: "Todas las intervenciones han sido eliminadas",
    });
  };

  const downloadTranscript = () => {
    const transcript = interventions.map((i) => ({
      speaker: i.participant.name,
      text: i.text,
      timestamp: i.timestamp,
    }));

    const blob = new Blob([JSON.stringify(transcript, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToN8n = async () => {
    if (!currentBotId) {
      toast({
        title: "Error",
        description: "No hay bot activo para enviar",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingToN8n(true);
      const response = await fetch(`/api/bot/${currentBotId}/send-to-n8n`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Error",
          description: data.error || data.details || "Error al enviar a n8n",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: `Transcripción enviada a n8n exitosamente (${data.total_interventions} intervenciones)`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al enviar a n8n",
        variant: "destructive",
      });
    } finally {
      setSendingToN8n(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="container mx-auto max-w-6xl">
        <header className="text-center mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/sessions"
              className="text-white hover:underline text-sm"
            >
              📚 Ver historial
            </Link>
          </div>
          <h1 className="text-4xl font-bold mb-2">🎤 Meet Audio Processor</h1>
          <p className="text-lg opacity-90">
            Transcripción en tiempo real de Google Meet
          </p>
        </header>

        <main className="space-y-6">
          {/* Connection Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Bot</CardTitle>
              <CardDescription>
                Configura los parámetros para crear el bot de transcripción
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="templateSelect">Plantilla (opcional)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedTemplateId || undefined}
                    onValueChange={handleTemplateSelect}
                  >
                    <SelectTrigger id="templateSelect" className="flex-1">
                      <SelectValue placeholder="Seleccionar plantilla..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin plantilla</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog
                    open={showSaveTemplateDialog}
                    onOpenChange={setShowSaveTemplateDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" type="button">
                        💾 Guardar como plantilla
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Guardar Plantilla</DialogTitle>
                        <DialogDescription>
                          Guarda la configuración actual como una plantilla
                          reutilizable
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-name-input">
                            Nombre de la plantilla
                          </Label>
                          <Input
                            id="template-name-input"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Ej: Reuniones en Español"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowSaveTemplateDialog(false);
                            setTemplateName("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveTemplate}>Guardar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meetingUrl">URL de Google Meet</Label>
                <Input
                  id="meetingUrl"
                  type="url"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de transcripción</Label>
                <RadioGroup
                  value={transcriptionType}
                  onValueChange={setTranscriptionType}
                >
                  <div className="flex items-start space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem
                      value="meeting_captions"
                      id="meeting_captions"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="meeting_captions"
                        className="font-semibold"
                      >
                        Meeting Caption Transcription
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Usa las captions nativas de la reunión
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem
                      value="ai_transcription"
                      id="ai_transcription"
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="ai_transcription"
                        className="font-semibold"
                      >
                        AI Transcription (Deepgram)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Transcripción avanzada con IA + Diarización perfecta
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="languageSelect">Idioma de transcripción</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="languageSelect">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detectar</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es-ES">Español (España)</SelectItem>
                    <SelectItem value="es-MX">Español (México)</SelectItem>
                    <SelectItem value="es-AR">Español (Argentina)</SelectItem>
                    <SelectItem value="fr-FR">Français</SelectItem>
                    <SelectItem value="de-DE">Deutsch</SelectItem>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="it-IT">Italiano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="botName">Nombre del bot</Label>
                <Input
                  id="botName"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Transcription Bot"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="botPhoto">Imagen del bot (opcional)</Label>
                <Input
                  id="botPhoto"
                  type="file"
                  accept="image/jpeg,image/jpg"
                  onChange={handleFileSelect}
                />
                {botPhotoPreview && (
                  <div className="relative inline-block mt-2">
                    <img
                      src={botPhotoPreview}
                      alt="Preview"
                      className="max-w-xs rounded-lg"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0"
                      onClick={() => {
                        setBotPhoto(null);
                        setBotPhotoPreview(null);
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                )}
              </div>

              <Button
                onClick={handleConnect}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Conectando..." : "Conectar Bot"}
              </Button>

              <div className="flex items-center gap-2 text-sm">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span>{isConnected ? "Conectado" : "Desconectado"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Transcription Panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>📝 Transcripción en Tiempo Real</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearTranscription}
                  >
                    Limpiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoScroll(!autoScroll)}
                  >
                    Auto-scroll: {autoScroll ? "ON" : "OFF"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTranscript}
                  >
                    📥 Descargar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSendToN8n}
                    disabled={
                      sendingToN8n ||
                      !currentBotId ||
                      interventions.length === 0
                    }
                  >
                    {sendingToN8n ? "Enviando..." : "📤 Enviar a n8n"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={transcriptionAreaRef}
                className="h-96 overflow-y-auto space-y-4 p-4 bg-muted rounded-lg"
              >
                {interventions.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Ingresa una URL de Google Meet y haz clic en "Conectar Bot"
                    para comenzar la transcripción
                  </p>
                ) : (
                  interventions.map((intervention) => (
                    <div
                      key={intervention.id}
                      className={`p-4 rounded-lg border ${
                        intervention.isPartial
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="font-semibold text-sm text-muted-foreground mb-1">
                        {intervention.participant.name ||
                          `Speaker ${intervention.participant.id}`}
                      </div>
                      <div className="text-base">{intervention.text}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(intervention.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audio Output Panel */}
          {showAudioPanel && (
            <Card>
              <CardHeader>
                <CardTitle>🔊 Reproducir Audio en el Bot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="audioFileInput">
                    Seleccionar archivo MP3
                  </Label>
                  <Input
                    id="audioFileInput"
                    type="file"
                    accept="audio/mpeg,audio/mp3"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button
                  onClick={handleSendAudio}
                  disabled={!audioFile || !currentBotId}
                  className="w-full"
                >
                  Reproducir Audio
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        <footer className="text-center mt-8 text-white opacity-75">
          <p>Powered by Recall.ai & Socket.io</p>
        </footer>
      </div>
    </div>
  );
}
