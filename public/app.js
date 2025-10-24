// WebSocket connection
const socket = io();

// DOM elements
const meetingUrlInput = document.getElementById("meetingUrl");
const languageSelect = document.getElementById("languageSelect");
const botNameInput = document.getElementById("botName");
const botPhotoInput = document.getElementById("botPhoto");
const filePreview = document.getElementById("filePreview");
const previewImage = document.getElementById("previewImage");
const removeImageBtn = document.getElementById("removeImage");
const connectBtn = document.getElementById("connectBtn");
const connectionStatus = document.getElementById("connectionStatus");
const transcriptionArea = document.getElementById("transcriptionArea");
const clearBtn = document.getElementById("clearBtn");
const scrollBtn = document.getElementById("scrollBtn");
const debugBtn = document.getElementById("debugBtn");

// State
let isConnected = false;
let autoScroll = true;
let currentBotId = null;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  updateConnectionStatus("disconnected");
});

function setupEventListeners() {
  // Connect button
  connectBtn.addEventListener("click", handleConnect);

  // Enter key in input
  meetingUrlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleConnect();
    }
  });

  // Clear button
  clearBtn.addEventListener("click", clearTranscription);

  // Auto-scroll toggle
  scrollBtn.addEventListener("click", toggleAutoScroll);

  // Debug button
  debugBtn.addEventListener("click", showDebugInfo);

  // Add cleanup button functionality
  const cleanupBtn = document.getElementById("cleanupBtn");
  if (cleanupBtn) {
    cleanupBtn.addEventListener("click", cleanupOrphanedSessions);
  }

  // Add bot status check functionality
  const statusBtn = document.getElementById("statusBtn");
  if (statusBtn) {
    statusBtn.addEventListener("click", checkBotStatus);
  }

  // File upload events
  botPhotoInput.addEventListener("change", handleFileSelect);
  removeImageBtn.addEventListener("click", removeSelectedImage);

  // Socket events
  socket.on("connect", () => {
    console.log("Connected to server");
    updateConnectionStatus("connected");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    updateConnectionStatus("disconnected");
  });

  socket.on("bot-created", (data) => {
    console.log("Bot created:", data);
    currentBotId = data.botId;
    updateConnectionStatus("connecting");
    showMessage(
      "Bot creado exitosamente usando Meeting Captions. Esperando conexión a la reunión...",
      "success"
    );

    // Show language configuration info for meeting captions
    showMessage(
      "Nota: Meeting Captions usa el idioma configurado en la reunión. Asegúrate de que el host tenga configurado el idioma correcto.",
      "info"
    );

    // Set timeout to check if bot connects within 30 seconds
    setTimeout(() => {
      if (connectionStatus.classList.contains("connecting")) {
        showMessage(
          "El bot está tardando en conectarse. Verifica que la reunión esté activa y que las captions estén habilitadas.",
          "warning"
        );
      }
    }, 30000);
  });

  socket.on("bot-error", (data) => {
    console.error("Bot error:", data);
    showMessage(`Error: ${data.message}`, "error");
    updateConnectionStatus("disconnected");
    resetConnectButton();
  });

  socket.on("bot-status", (data) => {
    console.log("Bot status received:", data);
    console.log("Current status:", data.status);

    if (data.status === "in_call") {
      updateConnectionStatus("connected");
      showMessage(
        "Bot conectado a la reunión. Comenzando transcripción con Meeting Captions...",
        "success"
      );
    } else if (data.status === "call_ended") {
      updateConnectionStatus("disconnected");
      showMessage("Llamada finalizada", "info");
    } else {
      console.log("Unknown bot status:", data.status);
      showMessage(`Estado del bot: ${data.status}`, "info");
    }
  });

  socket.on("transcription", (data) => {
    console.log("Transcription received:", data);
    displayTranscription(data);
  });
}

function handleConnect() {
  const meetingUrl = meetingUrlInput.value.trim();
  const selectedLanguage = languageSelect.value;
  const botName = botNameInput.value.trim() || "Transcription Bot";
  const botPhotoFile = botPhotoInput.files[0];

  if (!meetingUrl) {
    showMessage("Por favor ingresa una URL de Google Meet", "error");
    return;
  }

  if (!isValidGoogleMeetUrl(meetingUrl)) {
    showMessage("Por favor ingresa una URL válida de Google Meet", "error");
    return;
  }

  setConnectButtonLoading(true);
  updateConnectionStatus("connecting");

  // Create FormData for file upload
  const formData = new FormData();
  formData.append("meetingUrl", meetingUrl);
  formData.append("language", selectedLanguage);
  formData.append("botName", botName);

  if (botPhotoFile) {
    formData.append("botPhoto", botPhotoFile);
  }

  // Send file upload to backend
  fetch("/api/bot/create-with-image", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        showMessage(`Error: ${data.error}`, "error");
        updateConnectionStatus("disconnected");
        resetConnectButton();
      } else {
        currentBotId = data.botId;
        updateConnectionStatus("connecting");
        showMessage(
          "Bot creado exitosamente. Esperando conexión a la reunión...",
          "success"
        );

        // Bot photo is now set during bot creation, no need for separate call

        // Set timeout to check if bot connects within 30 seconds
        setTimeout(() => {
          if (connectionStatus.classList.contains("connecting")) {
            showMessage(
              "El bot está tardando en conectarse. Verifica que la reunión esté activa.",
              "warning"
            );
          }
        }, 30000);
      }
    })
    .catch((error) => {
      console.error("Error creating bot:", error);
      showMessage("Error al crear el bot", "error");
      updateConnectionStatus("disconnected");
      resetConnectButton();
    });
}

function isValidGoogleMeetUrl(url) {
  const meetUrlPattern = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i;
  return meetUrlPattern.test(url);
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];

  if (!file) {
    hideFilePreview();
    return;
  }

  // Validate file type
  if (
    !file.type.startsWith("image/jpeg") &&
    !file.type.startsWith("image/jpg")
  ) {
    showMessage("Por favor selecciona solo archivos JPEG", "error");
    event.target.value = "";
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showMessage("El archivo es demasiado grande. Máximo 5MB", "error");
    event.target.value = "";
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = function (e) {
    previewImage.src = e.target.result;
    filePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function removeSelectedImage() {
  botPhotoInput.value = "";
  hideFilePreview();
}

function hideFilePreview() {
  filePreview.style.display = "none";
  previewImage.src = "";
}

function setConnectButtonLoading(loading) {
  const btnText = connectBtn.querySelector(".btn-text");
  const btnLoading = connectBtn.querySelector(".btn-loading");

  if (loading) {
    connectBtn.disabled = true;
    connectBtn.classList.add("loading");
    btnText.style.display = "none";
    btnLoading.style.display = "inline";
  } else {
    connectBtn.disabled = false;
    connectBtn.classList.remove("loading");
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

function resetConnectButton() {
  setConnectButtonLoading(false);
}

function updateConnectionStatus(status) {
  connectionStatus.className = `status-indicator ${status}`;

  const statusText = connectionStatus.querySelector(".status-text");

  switch (status) {
    case "connected":
      statusText.textContent = "Conectado";
      isConnected = true;
      break;
    case "connecting":
      statusText.textContent = "Conectando...";
      isConnected = false;
      break;
    case "disconnected":
      statusText.textContent = "Desconectado";
      isConnected = false;
      currentBotId = null;
      break;
  }
}

function displayTranscription(data) {
  // Remove placeholder if it exists
  const placeholder = transcriptionArea.querySelector(
    ".transcription-placeholder"
  );
  if (placeholder) {
    placeholder.remove();
  }

  const transcriptItem = document.createElement("div");
  transcriptItem.className = `transcript-item ${
    data.type === "transcript.partial_data" ? "partial" : "final"
  }`;

  // Handle meeting captions format
  let speaker, text, timestamp;

  if (data.provider === "meeting_captions") {
    // Meeting captions format: data.transcript is an array of participants
    if (Array.isArray(data.transcript)) {
      // Process each participant's words
      data.transcript.forEach((participant) => {
        if (participant.words && participant.words.length > 0) {
          const participantName =
            participant.participant?.name ||
            `Speaker ${participant.participant?.id || "Unknown"}`;

          participant.words.forEach((word) => {
            const wordItem = document.createElement("div");
            wordItem.className = `transcript-item ${
              data.type === "transcript.partial_data" ? "partial" : "final"
            }`;

            wordItem.innerHTML = `
              <div class="transcript-speaker">${participantName}</div>
              <div class="transcript-text">${word.text}</div>
              <div class="transcript-timestamp">${formatTimestamp(
                word.start_timestamp?.absolute || data.timestamp
              )}</div>
            `;

            transcriptionArea.appendChild(wordItem);
          });
        }
      });
    } else {
      // Fallback for other formats
      speaker =
        data.transcript.participant?.name ||
        `Speaker ${data.transcript.participant?.id || "Unknown"}`;
      text = data.transcript.words?.map((w) => w.text).join(" ") || "";
      timestamp = formatTimestamp(data.timestamp);

      transcriptItem.innerHTML = `
        <div class="transcript-speaker">${speaker}</div>
        <div class="transcript-text">${text}</div>
        <div class="transcript-timestamp">${timestamp}</div>
      `;
      transcriptionArea.appendChild(transcriptItem);
    }
  } else {
    // Original format for other providers
    speaker =
      data.transcript.participant?.name ||
      `Speaker ${data.transcript.participant?.id || "Unknown"}`;
    text = data.transcript.words?.map((w) => w.text).join(" ") || "";
    timestamp = formatTimestamp(data.timestamp);

    transcriptItem.innerHTML = `
      <div class="transcript-speaker">${speaker}</div>
      <div class="transcript-text">${text}</div>
      <div class="transcript-timestamp">${timestamp}</div>
    `;
    transcriptionArea.appendChild(transcriptItem);
  }

  // Auto-scroll to bottom
  if (autoScroll) {
    const lastItem = transcriptionArea.lastElementChild;
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: "smooth" });
    }
  }
}

function clearTranscription() {
  transcriptionArea.innerHTML = `
        <div class="transcription-placeholder">
            <p>Ingresa una URL de Google Meet y haz clic en "Conectar Bot" para comenzar la transcripción con Meeting Captions</p>
            <p><small>Nota: Asegúrate de que las captions estén habilitadas en la reunión</small></p>
        </div>
    `;
}

function toggleAutoScroll() {
  autoScroll = !autoScroll;
  scrollBtn.textContent = `Auto-scroll: ${autoScroll ? "ON" : "OFF"}`;
  scrollBtn.style.background = autoScroll ? "#28a745" : "#dc3545";
  scrollBtn.style.color = "white";
}

function showMessage(message, type = "info") {
  // Create temporary message element
  const messageEl = document.createElement("div");
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;

  // Set background color based on type
  const colors = {
    success: "#28a745",
    error: "#dc3545",
    info: "#17a2b8",
    warning: "#ffc107",
  };

  messageEl.style.background = colors[type] || colors.info;

  document.body.appendChild(messageEl);

  // Remove after 3 seconds
  setTimeout(() => {
    messageEl.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 300);
  }, 3000);
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function showDebugInfo() {
  fetch("/debug/bots")
    .then((response) => response.json())
    .then((data) => {
      console.log("Debug info:", data);
      console.log("Active bots:", data.activeBots);
      console.log("Connected sockets:", data.connectedSockets);

      let message = `Bots activos: ${data.totalBots}, Sockets conectados: ${data.totalConnectedSockets}`;

      if (data.activeBots.length > 0) {
        message +=
          "\nBots: " +
          data.activeBots
            .map(
              (bot) =>
                `${bot.botId.substring(0, 8)} (socket: ${
                  bot.socketConnected ? "conectado" : "desconectado"
                })`
            )
            .join(", ");
      }

      showMessage(message, "info");
    })
    .catch((error) => {
      console.error("Error getting debug info:", error);
      showMessage("Error obteniendo información de debug", "error");
    });
}

function cleanupOrphanedSessions() {
  fetch("/debug/cleanup", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      console.log("Cleanup result:", data);
      showMessage(
        `Limpieza completada. Sesiones removidas: ${data.removedSessions}`,
        "success"
      );
    })
    .catch((error) => {
      console.error("Error cleaning up sessions:", error);
      showMessage("Error limpiando sesiones", "error");
    });
}

function checkBotStatus() {
  if (!currentBotId) {
    showMessage("No hay bot activo para verificar", "warning");
    return;
  }

  fetch(`/api/bot/${currentBotId}/status`)
    .then((response) => response.json())
    .then((data) => {
      console.log("Bot status:", data);

      let message = `Bot: ${data.status}`;
      if (data.hasOutputVideo) {
        message += `\n✅ Imagen configurada correctamente`;
      } else {
        message += `\n❌ Sin imagen configurada`;
      }

      showMessage(message, data.hasOutputVideo ? "success" : "warning");
    })
    .catch((error) => {
      console.error("Error checking bot status:", error);
      showMessage("Error verificando estado del bot", "error");
    });
}

// Bot photos are now set during bot creation, no separate function needed

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
