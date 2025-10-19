import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath, override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const householdId = '11111111-1111-1111-1111-111111111111';

async function checkPrefs() {
  const { data, error } = await supabase
    .from('family_prefs')
    .select('*')
    .eq('household_id', householdId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('🏠 Household Preferences:\n');
  console.log('Allowed Ratings:', data.allowed_ratings);
  console.log('Max Runtime:', data.max_runtime, 'minutes');
  console.log('Blocked Keywords:', data.blocked_keywords);
  console.log('Preferred Streaming Services:', data.preferred_streaming_services || '(none set)');
  console.log('Re-watch Exclusion Period:', data.rewatch_exclusion_days ?? 365, 'days');
}

checkPrefs();
