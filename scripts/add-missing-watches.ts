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

async function addMissingWatches() {
  console.log('🔧 Adding missing watch records...\n');

  // 1. The Sound of Music - should have 2024-06-01 AND 2025-06-25
  const { data: soundOfMusic } = await supabase
    .from('movies')
    .select('tmdb_id')
    .ilike('title', 'The Sound of Music')
    .single();

  if (soundOfMusic) {
    const { data: existingWatches } = await supabase
      .from('watches')
      .select('watched_at')
      .eq('household_id', householdId)
      .eq('tmdb_id', soundOfMusic.tmdb_id);

    console.log(`The Sound of Music (tmdb_id: ${soundOfMusic.tmdb_id})`);
    console.log(`  Current watches: ${existingWatches?.map(w => new Date(w.watched_at).toISOString().split('T')[0]).join(', ')}`);

    // Check if we need to add 2025-06-25
    const has2025Watch = existingWatches?.some(w =>
      new Date(w.watched_at).toISOString().split('T')[0] === '2025-06-25'
    );

    if (!has2025Watch) {
      const { error } = await supabase
        .from('watches')
        .insert({
          household_id: householdId,
          tmdb_id: soundOfMusic.tmdb_id,
          watched_at: '2025-06-25T00:00:00Z',
        });

      if (error) {
        console.log(`  ❌ Error adding 2025-06-25 watch: ${error.message}`);
      } else {
        console.log(`  ✅ Added watch for 2025-06-25`);
      }
    } else {
      console.log(`  ✅ Already has 2025-06-25 watch`);
    }
  }

  // 2. Cinderella - should have 2022-12-29 AND 2025-02-21
  const { data: cinderella } = await supabase
    .from('movies')
    .select('tmdb_id')
    .ilike('title', 'Cinderella')
    .single();

  if (cinderella) {
    const { data: existingWatches } = await supabase
      .from('watches')
      .select('watched_at')
      .eq('household_id', householdId)
      .eq('tmdb_id', cinderella.tmdb_id);

    console.log(`\nCinderella (tmdb_id: ${cinderella.tmdb_id})`);
    console.log(`  Current watches: ${existingWatches?.map(w => new Date(w.watched_at).toISOString().split('T')[0]).join(', ')}`);

    // Check if we need to add 2025-02-21
    const has2025Watch = existingWatches?.some(w =>
      new Date(w.watched_at).toISOString().split('T')[0] === '2025-02-21'
    );

    if (!has2025Watch) {
      const { error } = await supabase
        .from('watches')
        .insert({
          household_id: householdId,
          tmdb_id: cinderella.tmdb_id,
          watched_at: '2025-02-21T00:00:00Z',
        });

      if (error) {
        console.log(`  ❌ Error adding 2025-02-21 watch: ${error.message}`);
      } else {
        console.log(`  ✅ Added watch for 2025-02-21`);
      }
    } else {
      console.log(`  ✅ Already has 2025-02-21 watch`);
    }
  }

  console.log('\n✅ Done!');
}

addMissingWatches().catch(console.error);
