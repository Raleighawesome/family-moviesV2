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

async function checkWatchDates() {
  console.log('🔍 Checking watch dates from database...\n');

  const { data: watches } = await supabase
    .from('watches')
    .select('id, tmdb_id, watched_at, movies(title)')
    .eq('household_id', householdId)
    .order('watched_at', { ascending: true });

  if (!watches || watches.length === 0) {
    console.log('❌ No watches found');
    return;
  }

  console.log(`📊 Total watches: ${watches.length}\n`);
  console.log('First 10 watches:');
  watches.slice(0, 10).forEach((w: any, idx: number) => {
    console.log(`${idx + 1}. ${w.movies?.title || 'Unknown'}: ${new Date(w.watched_at).toLocaleDateString()}`);
  });

  console.log('\nLast 10 watches:');
  watches.slice(-10).forEach((w: any, idx: number) => {
    console.log(`${idx + 1}. ${w.movies?.title || 'Unknown'}: ${new Date(w.watched_at).toLocaleDateString()}`);
  });
}

checkWatchDates().catch(console.error);
