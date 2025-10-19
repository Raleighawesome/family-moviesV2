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

async function checkTmdb4978() {
  // Check movie with tmdb_id 4978
  const { data: movie } = await supabase
    .from('movies')
    .select('*')
    .eq('tmdb_id', 4978)
    .single();

  console.log('Movie with tmdb_id 4978:');
  console.log(movie);

  // Check watches for this movie
  const { data: watches } = await supabase
    .from('watches')
    .select('*')
    .eq('household_id', householdId)
    .eq('tmdb_id', 4978);

  console.log('\nWatches for tmdb_id 4978:');
  watches?.forEach(w =>
    console.log(`  - ${new Date(w.watched_at).toISOString()} (id: ${w.id})`)
  );
}

checkTmdb4978().catch(console.error);
