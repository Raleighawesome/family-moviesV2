import { config } from 'dotenv';
import { resolve } from 'path';
import { discoverMovies, getCompleteMovieData } from '../lib/tmdb/client';
import { normalizeTMDBMovie } from '../lib/tmdb/normalize';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function testNewFiltering() {
  console.log('🧪 Testing NEW family-friendly filtering approach...\n');
  console.log('🎬 Strategy:');
  console.log('   ✓ Include: Family-friendly genres');
  console.log('   ✓ Exclude: R, NC-17, X rated movies');
  console.log('   ✓ Max runtime: 180 minutes\n');

  // Fetch first page
  const results = await discoverMovies(1, {
    familyFriendly: true,
    maxRuntime: 180,
  });

  console.log(`📊 TMDB returned ${results.results.length} movies\n`);

  const blockedRatings = ['R', 'NC-17', 'X', 'Unrated'];
  let accepted = 0;
  let filtered = 0;

  // Test first 15 movies
  const testMovies = results.results.slice(0, 15);

  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i];
    console.log(`[${i + 1}/15] "${movie.title}"`);

    try {
      // Fetch complete data
      const movieData = await getCompleteMovieData(movie.id);
      const normalizedMovie = normalizeTMDBMovie(
        movieData.details,
        movieData.mpaaRating,
        movieData.keywords.keywords?.map(k => k.name) || []
      );

      const rating = normalizedMovie.rating || 'Not Rated';
      const runtime = normalizedMovie.runtime || '?';
      const genres = normalizedMovie.genres.join(', ');

      // Check if blocked
      if (normalizedMovie.rating && blockedRatings.includes(normalizedMovie.rating)) {
        console.log(`  ❌ BLOCKED: Rating "${rating}"`);
        filtered++;
      } else if (normalizedMovie.runtime && normalizedMovie.runtime > 180) {
        console.log(`  ❌ BLOCKED: Runtime ${runtime} min > 180`);
        filtered++;
      } else {
        console.log(`  ✅ ACCEPTED: ${rating} | ${runtime} min | ${genres}`);
        accepted++;
      }

      console.log();

    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown');
      console.log();
    }
  }

  console.log('='.repeat(60));
  console.log('📊 Results:');
  console.log('='.repeat(60));
  console.log(`✅ Would be added: ${accepted}`);
  console.log(`🚫 Would be filtered: ${filtered}`);
  console.log(`📈 Success rate: ${Math.round((accepted / 15) * 100)}%`);
  console.log('='.repeat(60));
}

testNewFiltering()
  .then(() => {
    console.log('\n✨ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
