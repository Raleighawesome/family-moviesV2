import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMovies() {
  const { data: movies, error } = await supabase
    .from('movies')
    .select('tmdb_id, title, year, mpaa')
    .order('title');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total movies in database: ${movies.length}\n`);

  const gMovies = movies.filter((m: any) => m.mpaa === 'G');
  const pgMovies = movies.filter((m: any) => m.mpaa === 'PG');

  console.log(`G-rated: ${gMovies.length}`);
  console.log(`PG-rated: ${pgMovies.length}\n`);

  console.log('All movies:');
  movies.forEach((m: any) => {
    console.log(`  ${m.mpaa || 'null'} - ${m.title} (${m.year})`);
  });
}

checkMovies().then(() => process.exit(0));
