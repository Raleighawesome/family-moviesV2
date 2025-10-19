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
const DESPICABLE_ME_TMDB_ID = 20352;

async function fixRating() {
  console.log('🔧 Updating Despicable Me rating from 10 to 5...\n');

  const { error } = await supabase
    .from('ratings')
    .update({ rating: 5 })
    .eq('household_id', householdId)
    .eq('tmdb_id', DESPICABLE_ME_TMDB_ID);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Rating updated to 5/10 stars');
}

fixRating();
