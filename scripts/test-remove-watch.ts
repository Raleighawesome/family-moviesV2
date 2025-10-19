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

async function testRemoveWatch() {
  console.log('🧪 Testing Remove Watch Functionality\n');

  // Get a sample watch to test removal
  const { data: watches } = await supabase
    .from('watches')
    .select('id, tmdb_id, watched_at, movies(title)')
    .eq('household_id', householdId)
    .limit(3);

  if (!watches || watches.length === 0) {
    console.log('❌ No watches found to test');
    return;
  }

  console.log('📋 Sample watches available:');
  watches.forEach((w: any, idx: number) => {
    console.log(`  ${idx + 1}. ID: ${w.id}, Movie: ${w.movies?.title}, Date: ${new Date(w.watched_at).toLocaleDateString()}`);
  });

  // Count watches before
  const { count: beforeCount } = await supabase
    .from('watches')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  console.log(`\n📊 Total watches before: ${beforeCount}`);

  // Check if any of these watches have multiple entries (for testing rating removal)
  for (const watch of watches) {
    const { data: sameMovie } = await supabase
      .from('watches')
      .select('id')
      .eq('household_id', householdId)
      .eq('tmdb_id', watch.tmdb_id);

    const isOnlyWatch = sameMovie?.length === 1;
    console.log(`\n🎬 ${watch.movies?.title}:`);
    console.log(`  - Watch ID: ${watch.id}`);
    console.log(`  - TMDB ID: ${watch.tmdb_id}`);
    console.log(`  - Total watches for this movie: ${sameMovie?.length}`);
    console.log(`  - Is only watch: ${isOnlyWatch}`);

    // Check if there's a rating for this movie
    const { data: rating } = await supabase
      .from('ratings')
      .select('rating')
      .eq('household_id', householdId)
      .eq('tmdb_id', watch.tmdb_id)
      .is('profile_id', null)
      .maybeSingle();

    if (rating) {
      console.log(`  - Rating: ${rating.rating}/10`);
      console.log(`  - Rating will be removed: ${isOnlyWatch}`);
    } else {
      console.log(`  - No rating for this movie`);
    }
  }

  console.log('\n✅ Test analysis complete. Ready to test remove functionality in UI.');
}

testRemoveWatch().catch(console.error);
