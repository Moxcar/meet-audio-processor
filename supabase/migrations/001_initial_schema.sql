-- Create bot_templates table
CREATE TABLE IF NOT EXISTS bot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  transcription_type TEXT NOT NULL CHECK (transcription_type IN ('meeting_captions', 'ai_transcription')),
  language TEXT NOT NULL,
  bot_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_bot_id TEXT UNIQUE NOT NULL,
  meeting_url TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  transcription_type TEXT NOT NULL CHECK (transcription_type IN ('meeting_captions', 'ai_transcription')),
  language TEXT NOT NULL,
  bot_photo_url TEXT,
  status TEXT NOT NULL,
  socket_id TEXT,
  output_video_url TEXT,
  template_id UUID REFERENCES bot_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ
);

-- Create interventions table
CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  is_partial BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL CHECK (provider IN ('meeting_captions', 'deepgram_streaming')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bots_recall_bot_id ON bots(recall_bot_id);
CREATE INDEX IF NOT EXISTS idx_bots_template_id ON bots(template_id);
CREATE INDEX IF NOT EXISTS idx_interventions_bot_id ON interventions(bot_id);
CREATE INDEX IF NOT EXISTS idx_interventions_timestamp ON interventions(timestamp);
CREATE INDEX IF NOT EXISTS idx_interventions_bot_id_timestamp ON interventions(bot_id, timestamp DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_bot_templates_updated_at
  BEFORE UPDATE ON bot_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

