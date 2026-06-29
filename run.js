require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const id = '7e1f7546-2238-4018-b728-72b4824cb19e';
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      brand:brands(*),
      form_type:form_types(*),
      user:users!orders_user_id_fkey(id, full_name, email),
      items:order_items(*),
      notes:order_notes(*, user:users(id, full_name, avatar_url))
    `)
    .eq('id', id)
    .single();
  console.log('Query Data:', data);
  console.log('Query Error:', error);
}
run();
