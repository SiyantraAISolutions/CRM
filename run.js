require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase
      .from('orders')
      .select('id, status, deferred_until')
      .or('status.in.(paid,processing,in_progress,completed),deferred_until.not.is.null');
  console.log('Query Data:', data);
  console.log('Query Error:', error);
}
run();
