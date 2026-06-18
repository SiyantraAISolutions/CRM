const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wyxwumckbggwbrghnahf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5eHd1bWNrYmdnd2JyZ2huYWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4MDQ1MywiZXhwIjoyMDk2OTU2NDUzfQ.RPlkyL8bphA2A3VDCMWx257LKZeDzor5TB6AbdcU92M'
);

async function run() {
  console.log('Fetching Calendly access token...');
  const { data: tokenSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'calendly_access_token')
    .single();

  const token = tokenSetting?.value;
  if (!token) {
    console.error('No Calendly access token found in database settings.');
    return;
  }

  const { data: orgSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'calendly_org_uri')
    .single();

  const org = orgSetting?.value;
  if (!org) {
    console.error('No Calendly organization URI found.');
    return;
  }

  console.log('Fetching Calendly webhook subscriptions...');
  const response = await fetch(`https://api.calendly.com/webhook_subscriptions?scope=organization&organization=${encodeURIComponent(org)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.error('Failed to fetch webhooks:', await response.text());
  } else {
    const resData = await response.json();
    console.log('Active webhooks in Calendly:');
    console.log(JSON.stringify(resData, null, 2));
  }
}

run();
