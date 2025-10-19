import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { discoverMovies, getCompleteMovieData } from '../lib/tmdb/client';
import { normalizeTMDBMovie } from '../lib/tmdb/normalize';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFiltering() {
  console.log('🧪 Testing improved family-friendly filtering...\n');
  console.log('🎬 Will fetch 10 movies and show filtering in action\n');

  // Fetch first page
  const results = await discoverMovies(1, {
    familyFriendly: true,
    certifications: ['G', 'PG', 'PG-13'],
    maxRuntime: 180,
  });

  console.log(`📊 Found ${results.results.length} movies from TMDB API\n`);

  const familyRatings = ['G', 'PG', 'PG-13'];
  let accepted = 0;
  let filtered = 0;
  let alreadyExists = 0;

  // Test first 10 movies
  const testMovies = results.results.slice(0, 10);

  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i];
    console.log(`[${i + 1}/10] "${movie.title}"`);

    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('movies')
        .select('tmdb_id')
        .eq('tmdb_id', movie.id)
        .maybeSingle();

      if (existing) {
        console.log('  ✓ Already in database\n');
        alreadyExists++;
        continue;
      }

      // Fetch complete data
      const movieData = await getCompleteMovieData(movie.id);
      const normalizedMovie = normalizeTMDBMovie(
        movieData.details,
        movieData.mpaaRating,
        movieData.keywords.keywords?.map(k => k.name) || []
      );

      const rating = normalizedMovie.rating || 'NR';
      const runtime = normalizedMovie.runtime || '?';

      // Check filters
      if (!normalizedMovie.rating || !familyRatings.includes(normalizedMovie.rating)) {
        console.log(`  ❌ FILTERED: Rating "${rating}" not in [G, PG, PG-13]\n`);
        filtered++;
        continue;
      }

      if (normalizedMovie.runtime && normalizedMovie.runtime > 180) {
        console.log(`  ❌ FILTERED: Runtime ${runtime} min > 180 min\n`);
        filtered++;
        continue;
      }

      console.log(`  ✅ ACCEPTED: Rating ${rating}, Runtime ${runtime} min`);

      // Check providers
      if (movieData.watchProviders.results.US) {
        const providers = movieData.watchProviders.results.US;
        const providerCount =
          (providers.flatrate?.length || 0) +
          (providers.rent?.length || 0) +
          (providers.buy?.length || 0);
        console.log(`  📺 ${providerCount} streaming options available`);
      } else {
        console.log(`  📺 No US providers`);
      }

      console.log();
      accepted++;

    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown');
      console.log();
    }
  }

  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Would be added: ${accepted}`);
  console.log(`⏭️  Already exist: ${alreadyExists}`);
  console.log(`🚫 Filtered out: ${filtered}`);
  console.log('='.repeat(60));
}

testFiltering()
  .then(() => {
    console.log('\n✨ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
