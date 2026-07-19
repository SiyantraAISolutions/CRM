// Run the order_drafts migration using Supabase Management API
// Usage: node scripts/run_migration.js

const SUPABASE_URL = 'https://wyxwumckbggwbrghnahf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHd1bWNrYmdnd2JyZ2huYWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4MDQ1MywiZXhwIjoyMDk2OTU2NDUzfQ.RPlkyL8bphA2A3VDCMWx257LKZeDzor5TB6AbdcU92M';

// The Supabase project ref (extracted from the URL)
const PROJECT_REF = 'wyxwumckbggwbrghnahf';

const sql = `
CREATE TABLE IF NOT EXISTS order_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  form_type_code TEXT,
  form_type_name TEXT,
  interaction_type TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  wizard_step INT DEFAULT 0,
  upsells JSONB DEFAULT '{}'::jsonb,
  order_items JSONB DEFAULT '[]'::jsonb,
  property_value TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  customer_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_user_id ON order_drafts(user_id);

ALTER TABLE order_drafts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_drafts' AND policyname = 'Users can manage own drafts'
  ) THEN
    CREATE POLICY "Users can manage own drafts"
      ON order_drafts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION update_order_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_order_drafts_updated_at ON order_drafts;

CREATE TRIGGER trigger_order_drafts_updated_at
  BEFORE UPDATE ON order_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_order_drafts_updated_at();
`;

async function runMigration() {
  console.log('Running order_drafts migration via Supabase SQL API...');

  // Use the Supabase pg-meta SQL endpoint
  const response = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'x-connection-encrypted': 'true',
    },
    body: JSON.stringify({ query: sql })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('✅ Migration completed successfully!');
    return;
  }

  // Fallback: try the management API
  console.log('Trying management API fallback...');
  const mgmtResponse = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    }
  );

  if (mgmtResponse.ok) {
    console.log('✅ Migration completed successfully via Management API!');
    return;
  }

  console.error(`❌ Both endpoints failed (${response.status}, ${mgmtResponse.status}).`);
  console.error('Please run the SQL manually in the Supabase Dashboard SQL Editor:');
  console.error('  1. Go to https://supabase.com/dashboard/project/wyxwumckbggwbrghnahf/sql');
  console.error('  2. Paste the contents of supabase/migrations/create_order_drafts.sql');
  console.error('  3. Click "Run"');
  process.exit(1);
}

runMigration().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
