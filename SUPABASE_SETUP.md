# Configuración de Supabase

Esta guía te ayudará a configurar Supabase como base de datos para la aplicación Meet Audio Processor.

## Pasos de Configuración

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta o inicia sesión
2. Crea un nuevo proyecto
3. Guarda las credenciales que se te proporcionan:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (clave pública)
   - **Service Role Key** (clave privada - solo para server-side)

### 2. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

**Importante:** 
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son públicas y se usan en el cliente
- `SUPABASE_SERVICE_ROLE_KEY` es privada y solo se usa en el servidor - nunca la expongas en el cliente

### 3. Ejecutar Migraciones SQL

1. Ve al SQL Editor en tu dashboard de Supabase
2. Copia el contenido del archivo `supabase/migrations/001_initial_schema.sql`
3. Pégalo en el editor SQL y ejecútalo
4. Esto creará las tablas necesarias:
   - `bot_templates` - Plantillas de bots reutilizables
   - `bots` - Información de bots creados
   - `interventions` - Intervenciones individuales de transcripción

### 4. Configurar Políticas de Seguridad (RLS)

Por defecto, Supabase usa Row Level Security (RLS). Para que la aplicación funcione correctamente, necesitas configurar las políticas:

**Opción A: Deshabilitar RLS (solo para desarrollo)**
```sql
ALTER TABLE bot_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE interventions DISABLE ROW LEVEL SECURITY;
```

**Opción B: Configurar políticas adecuadas (recomendado para producción)**

```sql
-- Políticas para bot_templates (lectura pública, escritura con autenticación)
CREATE POLICY "Allow public read access" ON bot_templates FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON bot_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON bot_templates FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON bot_templates FOR DELETE USING (true);

-- Políticas para bots (lectura pública, escritura con service role)
CREATE POLICY "Allow public read access" ON bots FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON bots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update" ON bots FOR UPDATE USING (true);

-- Políticas para interventions (lectura pública, escritura con service role)
CREATE POLICY "Allow public read access" ON interventions FOR SELECT USING (true);
CREATE POLICY "Allow service role insert" ON interventions FOR INSERT WITH CHECK (true);
```

**Nota:** En producción, deberías usar políticas más restrictivas basadas en autenticación de usuarios.

### 5. Verificar la Configuración

1. Reinicia tu servidor de desarrollo: `pnpm dev`
2. Intenta crear un bot - debería guardarse automáticamente en la base de datos
3. Revisa la tabla `bots` en Supabase para verificar que se está guardando correctamente

## Estructura de la Base de Datos

### Tabla: `bot_templates`
Almacena plantillas reutilizables de configuración de bots.

### Tabla: `bots`
Almacena información de cada bot creado, incluyendo:
- ID del bot en Recall.ai
- Estado del bot
- Configuración utilizada
- Relación con plantillas (opcional)

### Tabla: `interventions`
Almacena cada intervención individual de transcripción:
- Texto transcrito
- Participante/speaker
- Timestamp
- Si es parcial o final
- Proveedor de transcripción

## Consultas Útiles

```sql
-- Ver todos los bots creados
SELECT * FROM bots ORDER BY created_at DESC;

-- Ver intervenciones de un bot específico
SELECT * FROM interventions 
WHERE bot_id = (SELECT id FROM bots WHERE recall_bot_id = 'bot-id-aqui')
ORDER BY timestamp ASC;

-- Ver plantillas disponibles
SELECT * FROM bot_templates ORDER BY created_at DESC;

-- Estadísticas de bots
SELECT 
  status,
  COUNT(*) as count
FROM bots
GROUP BY status;
```

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Verifica que todas las variables de entorno estén configuradas en `.env`
- Reinicia el servidor después de agregar variables de entorno

### Error: "Failed to create bot" o "Failed to save interventions"
- Verifica que las políticas RLS estén configuradas correctamente
- Asegúrate de que el Service Role Key sea correcto
- Revisa los logs del servidor para más detalles

### Las intervenciones no se guardan
- Verifica que el webhook esté funcionando correctamente
- Revisa que el bot exista en la tabla `bots` antes de guardar intervenciones
- Verifica los logs del servidor cuando llegan eventos de transcripción

