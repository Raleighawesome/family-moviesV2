import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { discoverMovies, getCompleteMovieData } from '../lib/tmdb/client';
import { normalizeTMDBMovie } from '../lib/tmdb/normalize';
import { generateMovieEmbedding, embeddingToVector } from '../lib/openai/embeddings';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSeeding() {
  console.log('🧪 Testing family-friendly movie seeding...\n');
  console.log('🎬 Filtering for: G, PG, PG-13 ratings | Family-friendly genres\n');

  // Fetch first page only
  const results = await discoverMovies(1, {
    familyFriendly: true,
    certifications: ['G', 'PG', 'PG-13'],
    maxRuntime: 180,
  });

  console.log(`📊 Found ${results.results.length} movies on page 1\n`);

  // Process first 3 movies
  const testMovies = results.results.slice(0, 3);

  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i];
    console.log(`[${i + 1}/3] Processing "${movie.title}"...`);

    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('movies')
        .select('tmdb_id')
        .eq('tmdb_id', movie.id)
        .maybeSingle();

      if (existing) {
        console.log('  ℹ️  Already exists, skipping\n');
        continue;
      }

      // Fetch complete data
      const movieData = await getCompleteMovieData(movie.id);
      const normalizedMovie = normalizeTMDBMovie(
        movieData.details,
        movieData.mpaaRating,
        movieData.keywords.keywords?.map(k => k.name) || []
      );

      console.log(`  📝 Rating: ${normalizedMovie.rating || 'NR'}, Runtime: ${normalizedMovie.runtime || '?'} min`);

      // Generate embedding
      const embedding = await generateMovieEmbedding({
        title: normalizedMovie.title,
        overview: normalizedMovie.overview || '',
        genres: normalizedMovie.genres,
        keywords: normalizedMovie.keywords,
      });

      // Insert movie
      const { error } = await supabase
        .from('movies')
        .insert({
          ...normalizedMovie,
          embedding: embeddingToVector(embedding),
        });

      if (error) {
        console.error(`  ❌ Failed to insert:`, error.message);
        continue;
      }

      console.log(`  ✅ Movie inserted`);

      // Store providers
      if (movieData.watchProviders.results.US) {
        const providers = movieData.watchProviders.results.US;
        const providerCount =
          (providers.flatrate?.length || 0) +
          (providers.rent?.length || 0) +
          (providers.buy?.length || 0);

        const { error: providerError } = await supabase
          .from('movie_providers')
          .upsert({
            tmdb_id: movie.id,
            region: 'US',
            providers: {
              flatrate: providers.flatrate || [],
              rent: providers.rent || [],
              buy: providers.buy || [],
            },
          });

        if (providerError) {
          console.error(`  ❌ Failed to insert providers:`, providerError.message);
        } else {
          console.log(`  ✅ Providers inserted (${providerCount} options)`);
        }
      } else {
        console.log(`  ℹ️  No US providers available`);
      }

      console.log();
    } catch (error) {
      console.error(`  ❌ Error:`, error instanceof Error ? error.message : 'Unknown');
      console.log();
    }
  }

  console.log('✨ Test complete!');
}

testSeeding()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
