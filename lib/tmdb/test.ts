/**
 * Test script for TMDB integration
 * Run with: pnpm tsx lib/tmdb/test.ts
 */

// IMPORTANT: Load env vars BEFORE any other imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local'), override: true });

// Now import the TMDB module after env vars are loaded
import {
  searchMovies,
  getCompleteMovieData,
  normalizeTMDBMovie,
  normalizeTMDBProviders,
  formatRuntime,
  extractDirectors,
  extractMainCast,
} from './index';

async function testTMDBIntegration() {
  console.log('🎬 Testing TMDB Integration\n');

  try {
    // Test 1: Search for a movie
    console.log('1️⃣  Searching for "The Lion King" (1994)...');
    const searchResults = await searchMovies('The Lion King', 1994);
    console.log(`   Found ${searchResults.total_results} results`);

    if (searchResults.results.length === 0) {
      console.log('   ❌ No results found');
      return;
    }

    const firstResult = searchResults.results[0];
    console.log(`   ✅ First result: "${firstResult.title}" (TMDB ID: ${firstResult.id})\n`);

    // Test 2: Get complete movie data
    console.log('2️⃣  Fetching complete data for TMDB ID:', firstResult.id);
    const movieData = await getCompleteMovieData(firstResult.id);

    console.log(`   Title: ${movieData.details.title}`);
    console.log(`   Year: ${movieData.details.release_date?.split('-')[0]}`);
    console.log(`   Runtime: ${formatRuntime(movieData.details.runtime)}`);
    console.log(`   MPAA Rating: ${movieData.mpaaRating || 'Not rated'}`);
    console.log(`   Genres: ${movieData.details.genres.map(g => g.name).join(', ')}`);
    console.log(`   Overview: ${movieData.details.overview?.substring(0, 100)}...`);
    console.log(`   Keywords: ${movieData.keywords.keywords.slice(0, 5).map(k => k.name).join(', ')}`);
    console.log(`   Directors: ${extractDirectors(movieData.credits).join(', ')}`);
    console.log(`   Main Cast: ${extractMainCast(movieData.credits).join(', ')}\n`);

    // Test 3: Normalize to database format
    console.log('3️⃣  Normalizing to database format...');
    const dbMovie = normalizeTMDBMovie(
      movieData.details,
      movieData.mpaaRating,
      movieData.keywords.keywords.map(k => k.name)
    );
    console.log('   Database record:');
    console.log(JSON.stringify(dbMovie, null, 2));
    console.log();

    // Test 4: Get watch providers
    console.log('4️⃣  Fetching watch providers for US...');
    const providers = normalizeTMDBProviders(
      firstResult.id,
      'US',
      movieData.watchProviders
    );

    if (providers) {
      console.log('   Available on:');
      if (providers.providers.flatrate?.length) {
        console.log(`   Streaming: ${providers.providers.flatrate.map(p => p.provider_name).join(', ')}`);
      }
      if (providers.providers.rent?.length) {
        console.log(`   Rent: ${providers.providers.rent.map(p => p.provider_name).join(', ')}`);
      }
      if (providers.providers.buy?.length) {
        console.log(`   Buy: ${providers.providers.buy.map(p => p.provider_name).join(', ')}`);
      }
    } else {
      console.log('   No watch providers available for US region');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testTMDBIntegration();
