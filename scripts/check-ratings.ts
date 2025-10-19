import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRatings() {
  console.log('\n🔍 Checking watches and ratings...\n');

  // Get all watches
  const { data: watches, error: watchError } = await supabase
    .from('watches')
    .select('*')
    .order('watched_at', { ascending: false });

  if (watchError) {
    console.error('Error fetching watches:', watchError);
    return;
  }

  console.log(`📊 Total watches: ${watches?.length || 0}\n`);

  watches?.forEach((watch: any) => {
    console.log(`Watch ID: ${watch.id}`);
    console.log(`  Household ID: ${watch.household_id}`);
    console.log(`  Profile ID: ${watch.profile_id}`);
    console.log(`  TMDB ID: ${watch.tmdb_id}`);
    console.log(`  Watched At: ${watch.watched_at}\n`);
  });

  // Get all ratings
  const { data: ratings, error: ratingError } = await supabase
    .from('ratings')
    .select('*');

  if (ratingError) {
    console.error('Error fetching ratings:', ratingError);
    return;
  }

  console.log(`\n⭐ Total ratings: ${ratings?.length || 0}\n`);

  ratings?.forEach((rating: any) => {
    console.log(`Rating:`);
    console.log(`  Household ID: ${rating.household_id}`);
    console.log(`  Profile ID: ${rating.profile_id}`);
    console.log(`  TMDB ID: ${rating.tmdb_id}`);
    console.log(`  Rating: ${rating.rating} stars`);
    console.log(`  Rated At: ${rating.rated_at}\n`);
  });
}

checkRatings().then(() => process.exit(0));
