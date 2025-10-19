import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking database state...\n');

  // Check movies
  const { count: movieCount } = await supabase
    .from('movies')
    .select('*', { count: 'exact', head: true });

  console.log(`📽️  Movies: ${movieCount || 0}`);

  // Check households
  const { count: householdCount } = await supabase
    .from('households')
    .select('*', { count: 'exact', head: true });

  console.log(`🏠 Households: ${householdCount || 0}`);

  // Check watches
  const { count: watchCount } = await supabase
    .from('watches')
    .select('*', { count: 'exact', head: true });

  console.log(`👁️  Watches: ${watchCount || 0}`);

  // Check ratings
  const { count: ratingCount } = await supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true });

  console.log(`⭐ Ratings: ${ratingCount || 0}`);

  // Verify ratings table structure
  const { data: ratingsSample, error } = await supabase
    .from('ratings')
    .select('*')
    .limit(1);

  if (error) {
    console.log('\n❌ Error querying ratings:', error.message);
  } else {
    console.log('\n✅ Ratings table is accessible');
  }
}

checkTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
