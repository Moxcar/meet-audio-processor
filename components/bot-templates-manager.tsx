"use client";

import { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

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

export function BotTemplatesManager() {
  const [templates, setTemplates] = useState<BotTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BotTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    bot_name: "",
    transcription_type: "meeting_captions" as "meeting_captions" | "ai_transcription",
    language: "auto",
    bot_photo_url: "",
  });
  const [botPhotoPreview, setBotPhotoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/jpeg") && !file.type.startsWith("image/jpg")) {
        toast({
          title: "Error",
          description: "Por favor selecciona solo archivos JPEG",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBotPhotoPreview(result);
        setFormData((prev) => ({ ...prev, bot_photo_url: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTemplate) {
        // Update template
        const response = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to update template");
        toast({
          title: "Éxito",
          description: "Plantilla actualizada correctamente",
        });
      } else {
        // Create template
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to create template");
        toast({
          title: "Éxito",
          description: "Plantilla creada correctamente",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (template: BotTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      bot_name: template.bot_name,
      transcription_type: template.transcription_type,
      language: template.language,
      bot_photo_url: template.bot_photo_url || "",
    });
    setBotPhotoPreview(template.bot_photo_url);
    setIsDialogOpen(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");
      toast({
        title: "Éxito",
        description: "Plantilla eliminada correctamente",
      });
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      bot_name: "",
      transcription_type: "meeting_captions",
      language: "auto",
      bot_photo_url: "",
    });
    setBotPhotoPreview(null);
    setEditingTemplate(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>📋 Plantillas de Bots</CardTitle>
            <CardDescription>
              Gestiona plantillas reutilizables para crear bots rápidamente
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>Nueva Plantilla</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
                </DialogTitle>
                <DialogDescription>
                  Configura una plantilla para reutilizar configuraciones de bots
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Nombre de la plantilla</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ej: Reuniones en Español"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-bot-name">Nombre del bot</Label>
                  <Input
                    id="template-bot-name"
                    value={formData.bot_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bot_name: e.target.value,
                      }))
                    }
                    placeholder="Transcription Bot"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de transcripción</Label>
                  <RadioGroup
                    value={formData.transcription_type}
                    onValueChange={(value: any) =>
                      setFormData((prev) => ({
                        ...prev,
                        transcription_type: value,
                      }))
                    }
                  >
                    <div className="flex items-start space-x-2 p-4 border rounded-lg">
                      <RadioGroupItem
                        value="meeting_captions"
                        id="template-meeting-captions"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="template-meeting-captions"
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
                        id="template-ai-transcription"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="template-ai-transcription"
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
                  <Label htmlFor="template-language">Idioma</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, language: value }))
                    }
                  >
                    <SelectTrigger id="template-language">
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
                  <Label htmlFor="template-photo">Imagen del bot (opcional)</Label>
                  <Input
                    id="template-photo"
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
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0"
                        onClick={() => {
                          setBotPhotoPreview(null);
                          setFormData((prev) => ({ ...prev, bot_photo_url: "" }));
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTemplate ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Cargando plantillas...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay plantillas guardadas. Crea una nueva para comenzar.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {template.bot_name}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium">Tipo:</span>{" "}
                        {template.transcription_type === "meeting_captions"
                          ? "Meeting Captions"
                          : "AI Transcription"}
                      </div>
                      <div>
                        <span className="font-medium">Idioma:</span> {template.language}
                      </div>
                    </div>
                    {template.bot_photo_url && (
                      <div>
                        <img
                          src={template.bot_photo_url}
                          alt={template.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="flex-1"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                        className="flex-1"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

