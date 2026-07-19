// List all drafts currently in the database
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wyxwumckbggwbrghnahf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHd1bWNrYmdnd2JyZ2huYWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4MDQ1MywiZXhwIjoyMDk2OTU2NDUzfQ.RPlkyL8bphA2A3VDCMWx257LKZeDzor5TB6AbdcU92M';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('work_drafts').select('*');
  if (error) {
    console.error(error);
  } else {
    console.log(`Total drafts in database: ${data.length}`);
    data.forEach((d, idx) => {
      console.log(`[${idx + 1}] ID: ${d.id}, Type: ${d.draft_type}, Customer: ${d.customer_name}, Step: ${d.wizard_step}, Updated: ${d.updated_at}`);
    });
  }
}
check();
