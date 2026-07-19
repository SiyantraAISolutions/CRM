// Test database query for work_drafts table
// Usage: node scripts/test_db.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wyxwumckbggwbrghnahf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHd1bWNrYmdnd2JyZ2huYWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4MDQ1MywiZXhwIjoyMDk2OTU2NDUzfQ.RPlkyL8bphA2A3VDCMWx257LKZeDzor5TB6AbdcU92M';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function test() {
  console.log('Querying work_drafts table...');
  const { data, error } = await supabase
    .from('work_drafts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying work_drafts:', error.message);
    console.error(error);
  } else {
    console.log('✅ Success! work_drafts table query succeeded. Data:', data);
  }

  console.log('\nQuerying order_drafts table to see if it still exists...');
  const { data: dataOld, error: errorOld } = await supabase
    .from('order_drafts')
    .select('*')
    .limit(1);

  if (errorOld) {
    console.log('❌ Error querying order_drafts (expected if table was renamed):', errorOld.message);
  } else {
    console.log('⚠️ order_drafts table still exists! Data:', dataOld);
  }
}

test().catch(err => {
  console.error('Test failed:', err);
});
