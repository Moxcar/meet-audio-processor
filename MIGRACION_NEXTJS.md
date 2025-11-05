# Guía de Migración a Next.js con shadcn/ui

## ✅ Configuración Inicial Completada

La configuración base de Next.js con shadcn/ui ha sido completada exitosamente.

### Archivos Creados/Configurados:

- ✅ `next.config.js` - Configuración de Next.js
- ✅ `tsconfig.json` - Configuración de TypeScript
- ✅ `tailwind.config.ts` - Configuración de Tailwind CSS para shadcn
- ✅ `postcss.config.js` - Configuración de PostCSS
- ✅ `components.json` - Configuración de shadcn/ui
- ✅ `app/globals.css` - Estilos globales con variables CSS de shadcn
- ✅ `app/layout.tsx` - Layout principal de Next.js
- ✅ `app/page.tsx` - Página principal (ejemplo)
- ✅ `lib/utils.ts` - Utilidades para shadcn (cn function)
- ✅ `package.json` - Scripts actualizados

### Scripts Disponibles:

```bash
# Desarrollo con Next.js
pnpm dev

# Build para producción
pnpm build

# Iniciar servidor de producción
pnpm start

# Desarrollo con Express (servidor anterior)
pnpm dev:express

# Iniciar Express (servidor anterior)
pnpm start:express
```

## 📋 Próximos Pasos para Completar la Migración

### 1. Migrar Rutas API (app/api)

Las rutas actuales en `src/routes/index.js` deben migrarse a Next.js API routes:

```
app/api/
  ├── bot/
  │   ├── create/
  │   │   └── route.ts        # POST /api/bot/create
  │   ├── create-with-image/
  │   │   └── route.ts         # POST /api/bot/create-with-image
  │   ├── [botId]/
  │   │   ├── status/
  │   │   │   └── route.ts     # GET /api/bot/:botId/status
  │   │   ├── transcript/
  │   │   │   └── route.ts     # GET /api/bot/:botId/transcript
  │   │   └── output-audio/
  │   │       └── route.ts     # POST /api/bot/:botId/output-audio
  ├── send-to-n8n/
  │   └── route.ts             # POST /api/send-to-n8n
  └── webhook/
      └── transcription/
          └── route.ts         # POST /webhook/transcription
```

**Nota:** Para manejar archivos con multer, considera usar `formidable` o `next-formidable`.

### 2. Configurar Socket.IO

Socket.IO requiere un servidor HTTP separado. Opciones:

**Opción A: Servidor separado (Recomendado)**
- Mantener `server.js` para Socket.IO
- Next.js maneja las rutas API y frontend
- Socket.IO se ejecuta en un puerto diferente (ej: 3001)

**Opción B: Integrar en Next.js**
- Usar `socket.io` con un custom server de Next.js
- Más complejo pero todo en un solo proceso

### 3. Migrar Frontend a Componentes React

Convertir `public/index.html` y `public/app-modular.js` a componentes React:

**Componentes principales a crear:**
- `components/ConnectionPanel.tsx` - Panel de conexión
- `components/TranscriptionPanel.tsx` - Panel de transcripción
- `components/AudioOutputPanel.tsx` - Panel de salida de audio
- `hooks/useSocket.ts` - Hook para Socket.IO
- `hooks/useTranscription.ts` - Hook para manejar transcripciones

**Componentes shadcn útiles:**
```bash
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add label
pnpm dlx shadcn@latest add radio-group
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add alert
pnpm dlx shadcn@latest add dialog
```

### 4. Migrar Estilos

Los estilos de `public/styles.css` deben convertirse a:
- Clases de Tailwind CSS
- Componentes de shadcn/ui
- Variables CSS personalizadas (ya configuradas en `globals.css`)

### 5. Variables de Entorno

Asegúrate de tener un archivo `.env.local` para Next.js:

```env
RECALL_AI_API_KEY=your_recall_ai_api_key_here
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/transcript
PORT=3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001  # Si Socket.IO está separado
```

## 🚀 Comandos Útiles de shadcn

```bash
# Ver todos los componentes disponibles
pnpm dlx shadcn@latest add

# Agregar un componente específico
pnpm dlx shadcn@latest add [component-name]

# Agregar múltiples componentes
pnpm dlx shadcn@latest add button input card
```

## 📚 Recursos

- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## ⚠️ Notas Importantes

1. **Socket.IO**: Considera mantener un servidor Express separado para Socket.IO ya que Next.js no tiene soporte nativo para WebSockets en el servidor.

2. **Uploads**: Next.js maneja uploads de manera diferente. Considera usar `formidable` o manejar los archivos en el cliente antes de enviarlos.

3. **Middleware**: Los middleware de Express (`src/middleware/upload.js`) deben adaptarse a Next.js middleware o API routes.

4. **Estado**: Considera usar Context API o Zustand para el estado global de la aplicación.

5. **TypeScript**: Todos los archivos nuevos deben estar en TypeScript (.ts/.tsx).

## 🎯 Estado Actual

- ✅ Next.js configurado
- ✅ TypeScript configurado
- ✅ Tailwind CSS configurado
- ✅ shadcn/ui inicializado
- ⏳ Rutas API por migrar
- ⏳ Frontend por migrar
- ⏳ Socket.IO por configurar
- ⏳ Estilos por migrar

