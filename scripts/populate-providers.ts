#!/usr/bin/env tsx
/**
 * Populate movie_providers table with streaming availability data from TMDB
 *
 * This script:
 * 1. Fetches all movies from the database
 * 2. For each movie, calls TMDB API to get watch providers
 * 3. Inserts provider data into movie_providers table for US region
 *
 * Usage: tsx scripts/populate-providers.ts
 */

import { createClient } from '@supabase/supabase-js';
import { getMovieWatchProviders } from '@/lib/tmdb/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Movie {
  tmdb_id: number;
  title: string;
  year: number | null;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function to populate providers
 */
async function populateProviders() {
  console.log('🎬 Starting provider population...\n');

  // 1. Fetch all movies from database
  const { data: movies, error: fetchError } = await supabase
    .from('movies')
    .select('tmdb_id, title, year')
    .order('tmdb_id', { ascending: true });

  if (fetchError) {
    console.error('❌ Failed to fetch movies:', fetchError);
    process.exit(1);
  }

  if (!movies || movies.length === 0) {
    console.log('ℹ️  No movies found in database');
    return;
  }

  console.log(`📊 Found ${movies.length} movies in database\n`);

  // Track statistics
  let successCount = 0;
  let errorCount = 0;
  let noProvidersCount = 0;

  // 2. Process each movie
  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i] as Movie;
    const movieDisplay = `"${movie.title}"${movie.year ? ` (${movie.year})` : ''}`;

    console.log(`[${i + 1}/${movies.length}] Processing ${movieDisplay}...`);

    try {
      // Fetch watch providers from TMDB
      const providerResponse = await getMovieWatchProviders(movie.tmdb_id);

      // Extract US providers (you can add more regions if needed)
      const usProviders = providerResponse.results['US'];

      if (!usProviders) {
        console.log(`   ℹ️  No US providers available`);
        noProvidersCount++;
        continue;
      }

      // Format providers for database
      const providers = {
        flatrate: usProviders.flatrate || [],
        rent: usProviders.rent || [],
        buy: usProviders.buy || [],
      };

      // Insert into movie_providers table
      const { error: insertError } = await supabase
        .from('movie_providers')
        .upsert({
          tmdb_id: movie.tmdb_id,
          region: 'US',
          providers: providers,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`   ❌ Failed to insert providers:`, insertError.message);
        errorCount++;
      } else {
        const providerCount =
          (providers.flatrate?.length || 0) +
          (providers.rent?.length || 0) +
          (providers.buy?.length || 0);

        console.log(`   ✅ Added ${providerCount} provider option(s)`);
        successCount++;
      }

      // Rate limiting: small delay between requests (TMDB allows 40/sec, we'll be conservative)
      if (i < movies.length - 1) {
        await sleep(50); // 50ms = 20 requests/second
      }

    } catch (error) {
      console.error(`   ❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
      errorCount++;
    }
  }

  // 3. Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully added providers: ${successCount}`);
  console.log(`ℹ️  No providers available: ${noProvidersCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📺 Total processed: ${movies.length}`);
  console.log('='.repeat(60));
}

// Run the script
populateProviders()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
