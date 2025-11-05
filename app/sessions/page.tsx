"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface Bot {
  id: string;
  recall_bot_id: string;
  meeting_url: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  status: string;
  created_at: string;
  call_started_at: string | null;
  call_ended_at: string | null;
  output_video_url: string | null;
}

interface Intervention {
  id: string;
  participant_name: string;
  participant_id: number;
  text: string;
  timestamp: string;
  is_partial: boolean;
  provider: string;
}

interface BotWithInterventions extends Bot {
  interventions: Intervention[];
  interventionCount: number;
}

export default function SessionsPage() {
  const [bots, setBots] = useState<BotWithInterventions[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingToN8n, setSendingToN8n] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/bots");
      if (!response.ok) {
        throw new Error("Failed to load sessions");
      }
      const botsData: Bot[] = await response.json();

      // Load interventions for each bot
      const botsWithInterventions = await Promise.all(
        botsData.map(async (bot) => {
          try {
            const interventionsResponse = await fetch(
              `/api/interventions?botId=${bot.id}`
            );
            const interventions: Intervention[] = interventionsResponse.ok
              ? await interventionsResponse.json()
              : [];

            return {
              ...bot,
              interventions,
              interventionCount: interventions.filter((i) => !i.is_partial)
                .length,
            };
          } catch (error) {
            console.error(`Error loading interventions for bot ${bot.id}:`, error);
            return {
              ...bot,
              interventions: [],
              interventionCount: 0,
            };
          }
        })
      );

      setBots(botsWithInterventions);
    } catch (error: any) {
      console.error("Error loading sessions:", error);
      toast({
        title: "Error",
        description: error.message || "Error al cargar las sesiones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToN8n = async (botId: string, botName: string) => {
    try {
      setSendingToN8n(botId);
      const response = await fetch(`/api/bot/${botId}/send-to-n8n`, {
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
          description: `Transcripción de "${botName}" enviada a n8n exitosamente (${data.total_interventions} intervenciones)`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al enviar a n8n",
        variant: "destructive",
      });
    } finally {
      setSendingToN8n(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_call":
        return "bg-green-500";
      case "call_ended":
        return "bg-gray-500";
      case "created":
        return "bg-yellow-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "in_call":
        return "En llamada";
      case "call_ended":
        return "Finalizada";
      case "created":
        return "Creada";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-4">
      <div className="container mx-auto max-w-6xl">
        <header className="text-center mb-8 text-white">
          <h1 className="text-4xl font-bold mb-2">📚 Historial de Sesiones</h1>
          <p className="text-lg opacity-90">
            Visualiza y gestiona las transcripciones de sesiones pasadas
          </p>
        </header>

        <div className="mb-4">
          <Link href="/">
            <Button variant="outline" className="bg-white">
              ← Volver a la página principal
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p>Cargando sesiones...</p>
            </CardContent>
          </Card>
        ) : bots.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No hay sesiones guardadas todavía
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bots.map((bot) => (
              <Card key={bot.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {bot.bot_name}
                        <span
                          className={`w-2 h-2 rounded-full ${getStatusColor(
                            bot.status
                          )}`}
                        />
                        <span className="text-sm font-normal text-muted-foreground">
                          {getStatusText(bot.status)}
                        </span>
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <div className="space-y-1">
                          <p>
                            <strong>Reunión:</strong>{" "}
                            <a
                              href={bot.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {bot.meeting_url}
                            </a>
                          </p>
                          <p>
                            <strong>Creada:</strong> {formatDate(bot.created_at)}
                          </p>
                          {bot.call_started_at && (
                            <p>
                              <strong>Iniciada:</strong>{" "}
                              {formatDate(bot.call_started_at)}
                            </p>
                          )}
                          {bot.call_ended_at && (
                            <p>
                              <strong>Finalizada:</strong>{" "}
                              {formatDate(bot.call_ended_at)}
                            </p>
                          )}
                          <p>
                            <strong>Intervenciones:</strong>{" "}
                            {bot.interventionCount}
                          </p>
                          <p>
                            <strong>Tipo:</strong>{" "}
                            {bot.transcription_type === "ai_transcription"
                              ? "AI Transcription (Deepgram)"
                              : "Meeting Captions"}
                          </p>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleSendToN8n(bot.id, bot.bot_name)}
                        disabled={sendingToN8n === bot.id || bot.interventionCount === 0}
                        variant="default"
                      >
                        {sendingToN8n === bot.id
                          ? "Enviando..."
                          : "📤 Enviar a n8n"}
                      </Button>
                      {bot.output_video_url && (
                        <Button
                          variant="outline"
                          asChild
                        >
                          <a
                            href={bot.output_video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🎥 Ver video
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {bot.interventions.length > 0 && (
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      <h3 className="font-semibold mb-2">Transcripción:</h3>
                      {bot.interventions
                        .filter((i) => !i.is_partial)
                        .map((intervention) => (
                          <div
                            key={intervention.id}
                            className="p-3 rounded-lg border bg-white"
                          >
                            <div className="font-semibold text-sm text-muted-foreground mb-1">
                              {intervention.participant_name ||
                                `Speaker ${intervention.participant_id}`}
                            </div>
                            <div className="text-base">{intervention.text}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(intervention.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

