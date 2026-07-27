const path = require('path');
const projectDir = __dirname ? path.resolve(__dirname, '..') : 'c:/Users/gkaru/Downloads/crm-develop/crm-develop/mu-management';
const { createClient } = require(path.join(projectDir, 'node_modules/@supabase/supabase-js'));
require(path.join(projectDir, 'node_modules/dotenv')).config({ path: path.join(projectDir, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function formatLabel(str) {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function recoverData() {
  console.log('1. Fetching all orders, order notes, and work drafts...');

  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (ordersErr) {
    console.error('Error fetching orders:', ordersErr);
    process.exit(1);
  }

  const { data: notes, error: notesErr } = await supabase
    .from('order_notes')
    .select('id, order_id, category, message, created_at')
    .order('created_at', { ascending: false });

  if (notesErr) {
    console.error('Error fetching notes:', notesErr);
  }

  const { data: drafts } = await supabase
    .from('work_drafts')
    .select('user_id, customer_name, form_data, created_at')
    .order('created_at', { ascending: false });

  console.log(`   Found ${orders.length} orders, ${notes?.length || 0} order notes, ${drafts?.length || 0} work drafts.`);

  // Group notes by order_id
  const notesByOrder = {};
  for (const n of notes || []) {
    if (!notesByOrder[n.order_id]) notesByOrder[n.order_id] = [];
    notesByOrder[n.order_id].push(n);
  }

  let notesCreatedCount = 0;
  let ordersProcessed = 0;

  for (const order of orders) {
    ordersProcessed++;
    const orderNotes = notesByOrder[order.id] || [];

    // Check if an "Application Details" note already exists for this order
    const existingAppNote = orderNotes.find(
      n => n.category === 'Application Details' || (n.message && n.message.includes('📋 Application Form Details'))
    );

    const detailsMap = {};

    // 1. Populate details from order columns
    if (order.title) detailsMap['Title'] = order.title;
    if (order.first_name) detailsMap['First Name'] = order.first_name;
    if (order.middle_name) detailsMap['Middle Name'] = order.middle_name;
    if (order.last_name) detailsMap['Surname'] = order.last_name;
    if (order.email) detailsMap['Email'] = order.email;
    if (order.phone) detailsMap['Phone'] = order.phone;
    if (order.address_line1) detailsMap['Address Line 1'] = order.address_line1;
    if (order.address_line2) detailsMap['Address Line 2'] = order.address_line2;
    if (order.city) detailsMap['City'] = order.city;
    if (order.county) detailsMap['County'] = order.county;
    if (order.postcode) detailsMap['Postcode'] = order.postcode;
    if (order.title_number) detailsMap['Title Number'] = order.title_number;
    if (order.tenure) detailsMap['Tenure'] = order.tenure;
    if (order.property_value) detailsMap['Property Value'] = `£${Number(order.property_value).toFixed(2)}`;
    if (order.hmlr_fee) detailsMap['HMLR Fee'] = `£${Number(order.hmlr_fee).toFixed(2)}`;
    if (order.tenancy_type) detailsMap['Tenancy Type'] = order.tenancy_type;
    if (typeof order.is_mortgaged === 'boolean') detailsMap['Is Mortgaged'] = order.is_mortgaged ? 'Yes' : 'No';

    // 2. Parse any other existing order notes for key-value pairs
    for (const n of orderNotes) {
      if (!n.message) continue;
      const lines = n.message.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        let bulletContent = '';
        if (trimmed.startsWith('•')) bulletContent = trimmed.slice(1).trim();
        else if (trimmed.startsWith('-')) bulletContent = trimmed.slice(1).trim();
        else if (trimmed.includes(':') && !trimmed.startsWith('http') && !trimmed.toLowerCase().includes('status changed') && !trimmed.toLowerCase().includes('payment')) {
          bulletContent = trimmed;
        }

        if (bulletContent && bulletContent.includes(':')) {
          const colonIdx = bulletContent.indexOf(':');
          const k = formatLabel(bulletContent.slice(0, colonIdx).trim());
          const v = bulletContent.slice(colonIdx + 1).trim();
          if (k && v && !detailsMap[k]) {
            detailsMap[k] = v;
          }
        }
      }
    }

    // 3. Cross-reference matching work_drafts
    if (drafts && drafts.length > 0) {
      const orderCustomer = `${order.first_name || ''} ${order.last_name || ''}`.trim().toLowerCase();
      const matchedDraft = drafts.find(d => {
        if (!d.form_data) return false;
        if (d.user_id && d.user_id === order.user_id) return true;
        if (d.customer_name && orderCustomer && d.customer_name.toLowerCase().includes(orderCustomer)) return true;
        return false;
      });

      if (matchedDraft && matchedDraft.form_data) {
        for (const [k, v] of Object.entries(matchedDraft.form_data)) {
          if (v) {
            const formattedK = formatLabel(k);
            if (!detailsMap[formattedK]) {
              detailsMap[formattedK] = String(v);
            }
          }
        }
      }
    }

    // 4. Construct formatted application details note message
    const formattedLines = Object.entries(detailsMap).map(([k, v]) => `• ${k}: ${v}`);
    if (formattedLines.length === 0) continue;

    const noteMessage = `📋 Application Form Details Captured:\n\n${formattedLines.join('\n')}`;

    if (!existingAppNote) {
      // Insert new Application Details note
      const { error: insertErr } = await supabase.from('order_notes').insert({
        order_id: order.id,
        message: noteMessage,
        category: 'Application Details',
      });

      if (insertErr) {
        console.error(`Failed to insert application note for order ${order.id}:`, insertErr.message);
      } else {
        notesCreatedCount++;
      }
    } else {
      // Update existing Application Details note if details map expanded
      const { error: updateErr } = await supabase
        .from('order_notes')
        .update({ message: noteMessage, category: 'Application Details' })
        .eq('id', existingAppNote.id);

      if (!updateErr) {
        notesCreatedCount++;
      }
    }
  }

  console.log(`\n🎉 Recovery Complete! Form details generated/updated for ${notesCreatedCount} / ${ordersProcessed} orders in order_notes.`);
}

recoverData().catch(err => {
  console.error('Data recovery error:', err);
  process.exit(1);
});
