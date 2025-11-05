-- Disable RLS for development (allows public read/write)
-- For production, you should enable RLS and use proper authentication

-- Disable RLS on all tables (for development/testing)
ALTER TABLE bot_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE interventions DISABLE ROW LEVEL SECURITY;

