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

async function fixCinderellaFinal() {
  console.log('🔧 Fixing Cinderella watch dates...\n');

  // Delete the incorrectly added watch (id: 95) from An American Tail
  console.log('Removing incorrectly added watch from An American Tail...');
  const { error: deleteError } = await supabase
    .from('watches')
    .delete()
    .eq('id', 95);

  if (deleteError) {
    console.log(`❌ Error deleting watch: ${deleteError.message}`);
  } else {
    console.log(`✅ Deleted incorrect watch (id: 95)`);
  }

  // Find the Cinderella movie that has a 2022-12-29 watch
  const { data: cinderellaWatches } = await supabase
    .from('watches')
    .select('id, tmdb_id, watched_at, movies(title)')
    .eq('household_id', householdId)
    .gte('watched_at', '2022-12-29T00:00:00Z')
    .lte('watched_at', '2022-12-29T23:59:59Z');

  console.log('\nMovies watched on 2022-12-29:');
  cinderellaWatches?.forEach((w: any) => {
    console.log(`  - ${w.movies?.title} (tmdb_id: ${w.tmdb_id}, watch_id: ${w.id})`);
  });

  // Find Cinderella specifically (watch id 68 or 93)
  const cinderellaWatch = cinderellaWatches?.find((w: any) =>
    w.movies?.title === 'Cinderella'
  );

  if (cinderellaWatch) {
    console.log(`\nAdding 2025-02-21 watch to Cinderella (tmdb_id: ${cinderellaWatch.tmdb_id})...`);

    const { error: insertError } = await supabase
      .from('watches')
      .insert({
        household_id: householdId,
        tmdb_id: cinderellaWatch.tmdb_id,
        watched_at: '2025-02-21T00:00:00Z',
      });

    if (insertError) {
      console.log(`❌ Error adding watch: ${insertError.message}`);
    } else {
      console.log(`✅ Added watch for 2025-02-21`);
    }
  } else {
    console.log('\n❌ Could not find Cinderella with 2022-12-29 watch');
  }
}

fixCinderellaFinal().catch(console.error);
