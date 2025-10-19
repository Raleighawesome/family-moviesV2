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

async function verifyImport() {
  console.log('🔍 Verifying import...\n');

  // Count watches
  const { data: watches, count: watchCount } = await supabase
    .from('watches')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId);

  console.log(`✅ Total watches: ${watchCount}`);

  // Count ratings
  const { data: ratings, count: ratingCount } = await supabase
    .from('ratings')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId);

  console.log(`✅ Total ratings: ${ratingCount}`);

  // Count movies
  const { data: movies, count: movieCount } = await supabase
    .from('movies')
    .select('tmdb_id', { count: 'exact' });

  console.log(`✅ Total movies in database: ${movieCount}`);

  // Show some sample watches with ratings
  const { data: watchesWithRatings } = await supabase
    .from('watches')
    .select(`
      watched_at,
      notes,
      movies (title, year),
      ratings (rating)
    `)
    .eq('household_id', householdId)
    .order('watched_at', { ascending: false })
    .limit(10);

  console.log('\n📊 Recent watches with ratings:');
  watchesWithRatings?.forEach((w: any) => {
    const rating = w.ratings?.[0]?.rating || 'none';
    const title = w.movies?.title || 'Unknown';
    const year = w.movies?.year || '';
    const date = new Date(w.watched_at).toLocaleDateString();
    console.log(`  - ${title} (${year}) - ${rating}/10 stars - ${date}`);
  });
}

verifyImport().catch(console.error);
