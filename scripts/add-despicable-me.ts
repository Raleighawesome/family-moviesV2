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
const DESPICABLE_ME_TMDB_ID = 20662;

async function addDespicableMe() {
  console.log('🎬 Adding "Despicable Me" to watch history...\n');

  // Check if movie exists in database
  const { data: movie } = await supabase
    .from('movies')
    .select('tmdb_id, title, year')
    .eq('tmdb_id', DESPICABLE_ME_TMDB_ID)
    .single();

  if (!movie) {
    console.log('❌ Movie not found in database. Need to add it first from TMDB.');
    return;
  }

  console.log(`Found movie: ${movie.title} (${movie.year})\n`);

  // Add watch record for Oct 17, 2025
  const { data: watchData, error: watchError } = await supabase
    .from('watches')
    .insert({
      household_id: householdId,
      tmdb_id: DESPICABLE_ME_TMDB_ID,
      watched_at: '2025-10-17T00:00:00Z',
      rewatch: false,
      notes: null,
      profile_id: null,
    })
    .select();

  if (watchError) {
    console.error('❌ Error adding watch:', watchError);
    return;
  }

  console.log('✅ Added watch record for Oct 17, 2025\n');

  // Add rating of 5/10
  const { error: ratingError } = await supabase
    .from('ratings')
    .upsert({
      household_id: householdId,
      tmdb_id: DESPICABLE_ME_TMDB_ID,
      rating: 5,
      rated_at: new Date().toISOString(),
      profile_id: null,
    });

  if (ratingError) {
    console.error('❌ Error adding rating:', ratingError);
    return;
  }

  console.log('✅ Added rating: 5/10 stars\n');

  // Since rating is >= 4, refresh taste vector
  const { error: tasteError } = await supabase.rpc('refresh_family_taste', {
    p_household_id: householdId,
  });

  if (tasteError) {
    console.log('⚠️  Could not refresh taste vector:', tasteError.message);
  } else {
    console.log('✅ Refreshed family taste vector\n');
  }

  console.log('🎉 Done! "Despicable Me" has been added to your watch history.');
}

addDespicableMe();
