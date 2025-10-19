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

async function fixCinderellaWatch() {
  console.log('🔧 Adding missing Cinderella (2025-02-21) watch...\n');

  // The CSV has two Cinderella entries:
  // 1. 2022-12-29 - likely the classic Disney animated version
  // 2. 2025-02-21 - a more recent watch

  // Let's check which Cinderella has the 2022-12-29 watch
  const { data: watch2022 } = await supabase
    .from('watches')
    .select('tmdb_id, movies(title)')
    .eq('household_id', householdId)
    .gte('watched_at', '2022-12-29T00:00:00Z')
    .lte('watched_at', '2022-12-29T23:59:59Z')
    .ilike('movies.title', 'Cinderella')
    .limit(1)
    .single();

  if (watch2022) {
    console.log(`Found Cinderella with 2022-12-29 watch: tmdb_id ${watch2022.tmdb_id}`);

    // Add the 2025-02-21 watch for the same movie
    const { error } = await supabase
      .from('watches')
      .insert({
        household_id: householdId,
        tmdb_id: watch2022.tmdb_id,
        watched_at: '2025-02-21T00:00:00Z',
      });

    if (error) {
      console.log(`❌ Error adding watch: ${error.message}`);
    } else {
      console.log(`✅ Added watch for 2025-02-21`);
    }
  } else {
    console.log('❌ Could not find Cinderella with 2022-12-29 watch');
  }
}

fixCinderellaWatch().catch(console.error);
