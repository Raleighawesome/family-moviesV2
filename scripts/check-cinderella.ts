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

async function checkCinderella() {
  // Find all Cinderella movies
  const { data: movies } = await supabase
    .from('movies')
    .select('tmdb_id, title')
    .ilike('title', '%cinderella%');

  console.log('Cinderella movies in database:');
  movies?.forEach(m => console.log(`  - ${m.title} (tmdb_id: ${m.tmdb_id})`));

  // Check watches for each
  if (movies) {
    for (const movie of movies) {
      const { data: watches } = await supabase
        .from('watches')
        .select('id, watched_at')
        .eq('household_id', householdId)
        .eq('tmdb_id', movie.tmdb_id);

      console.log(`\n${movie.title}:`);
      if (watches && watches.length > 0) {
        watches.forEach(w =>
          console.log(`  - ${new Date(w.watched_at).toISOString().split('T')[0]} (id: ${w.id})`)
        );
      } else {
        console.log('  - No watches');
      }
    }
  }
}

checkCinderella().catch(console.error);
