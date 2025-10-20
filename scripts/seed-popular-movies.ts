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

// Target number of movies to import
const TARGET_MOVIES = process.env.SEED_TARGET ? parseInt(process.env.SEED_TARGET) : 5000;

// Statistics
let stats = {
  processed: 0,
  added: 0,
  skipped: 0,
  filteredContent: 0, // Filtered out due to rating/runtime
  errors: 0,
  startTime: Date.now(),
};

async function seedMovie(tmdbId: number): Promise<boolean> {
  try {
    // Check if movie already exists
    const { data: existing } = await supabase
      .from('movies')
      .select('tmdb_id')
      .eq('tmdb_id', tmdbId)
      .maybeSingle();

    if (existing) {
      stats.skipped++;
      return false;
    }

    // Fetch complete movie data from TMDB
    const movieData = await getCompleteMovieData(tmdbId);
    const normalizedMovie = normalizeTMDBMovie(
      movieData.details,
      movieData.mpaaRating,
      movieData.keywords.keywords?.map(k => k.name) || []
    );

    // Strict family-friendly rating filter
    // ONLY allow: G, PG, PG-13, and unrated/null movies
    // Block everything else: R, NC-17, X, TV-MA, etc.
    const allowedRatings = ['G', 'PG', 'PG-13'];
    if (normalizedMovie.mpaa && !allowedRatings.includes(normalizedMovie.mpaa)) {
      stats.filteredContent++;
      return false;
    }

    // Skip movies that are too long (> 180 minutes)
    if (normalizedMovie.runtime && normalizedMovie.runtime > 180) {
      stats.filteredContent++;
      return false;
    }

    // Filter out movies with adult keywords
    const adultKeywords = ['sexual', 'erotic', 'porn', 'adult', 'xxx', 'sex'];
    const titleLower = normalizedMovie.title.toLowerCase();
    const overviewLower = (normalizedMovie.overview || '').toLowerCase();
    const hasAdultContent = adultKeywords.some(keyword =>
      titleLower.includes(keyword) || overviewLower.includes(keyword)
    );

    if (hasAdultContent) {
      stats.filteredContent++;
      return false;
    }

    // Generate embedding
    const embedding = await generateMovieEmbedding({
      title: normalizedMovie.title,
      overview: normalizedMovie.overview || '',
      genres: normalizedMovie.genres,
      keywords: normalizedMovie.keywords,
    });

    // Insert into database
    const { error } = await supabase
      .from('movies')
      .insert({
        ...normalizedMovie,
        embedding: embeddingToVector(embedding),
      });

    if (error) {
      // If it's a duplicate key error, count as skipped instead of error
      if (error.code === '23505') {
        stats.skipped++;
        return false;
      }
      console.error(`  ❌ Failed to insert ${normalizedMovie.title}:`, error.message);
      stats.errors++;
      return false;
    }

    // Store watch providers for US region
    if (movieData.watchProviders.results.US) {
      const providers = movieData.watchProviders.results.US;
      const { error: providerError } = await supabase
        .from('movie_providers')
        .upsert({
          tmdb_id: tmdbId,
          region: 'US',
          providers: {
            flatrate: providers.flatrate || [],
            rent: providers.rent || [],
            buy: providers.buy || [],
          },
        });

      if (providerError) {
        console.error(`  ⚠️  Failed to store providers for ${normalizedMovie.title}:`, providerError.message);
      }
    }

    stats.added++;
    return true;

  } catch (error) {
    stats.errors++;
    if (error instanceof Error && !error.message.includes('404')) {
      console.error(`  ❌ Error processing movie ${tmdbId}:`, error.message);
    }
    return false;
  }
}

function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  const remaining = TARGET_MOVIES - stats.added;
  const eta = remaining / rate;

  console.log(`\n📊 Progress: ${stats.processed} processed | ${stats.added} added | ${stats.skipped} already exist | ${stats.filteredContent} filtered | ${stats.errors} errors`);
  console.log(`⏱️  Rate: ${rate.toFixed(1)}/sec | ETA: ${Math.ceil(eta / 60)} minutes\n`);
}

async function seedDatabase() {
  console.log('🌱 Starting to seed popular family-friendly movies database...');
  console.log(`🎯 Target: ${TARGET_MOVIES} movies\n`);
  console.log('🎬 Strategy:');
  console.log('   ✓ Include: Family-friendly genres (Animation, Family, Adventure, Comedy, Fantasy)');
  console.log('   ✓ Exclude: R, NC-17, X rated movies');
  console.log('   ✓ Exclude: Horror, Thriller, Crime, War genres');
  console.log('   ✓ Max runtime: 180 minutes\n');

  let page = 1;
  const processedIds = new Set<number>();

  while (stats.added < TARGET_MOVIES) {
    try {
      // Fetch a page of popular family-friendly movies
      console.log(`📄 Fetching page ${page}...`);
      const results = await discoverMovies(page, {
        familyFriendly: true,
        maxRuntime: 180,
      });

      if (!results.results || results.results.length === 0) {
        console.log('No more movies to fetch');
        break;
      }

      // Process movies sequentially to avoid race conditions with duplicates
      for (const movie of results.results) {
        if (stats.added >= TARGET_MOVIES) break;
        if (processedIds.has(movie.id)) continue;

        processedIds.add(movie.id);
        stats.processed++;

        const success = await seedMovie(movie.id);

        if (success) {
          const title = movie.title.length > 40 ? movie.title.substring(0, 40) + '...' : movie.title;
          console.log(`  ✅ [${stats.added}/${TARGET_MOVIES}] ${title}`);
        }

        // Progress update every 25 movies
        if (stats.processed % 25 === 0) {
          printProgress();
        }
      }

      page++;

      // Don't go beyond page 500 (TMDB limit)
      if (page > 500) {
        console.log('Reached TMDB page limit');
        break;
      }

    } catch (error) {
      console.error('Error fetching page:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  printProgress();
  console.log('\n✨ Seeding complete!');
  console.log(`   ✅ Successfully added: ${stats.added}`);
  console.log(`   ⏭️  Skipped (already exist): ${stats.skipped}`);
  console.log(`   🚫 Filtered (rating/runtime): ${stats.filteredContent}`);
  console.log(`   ❌ Errors: ${stats.errors}`);
  console.log(`   ⏱️  Total time: ${Math.ceil((Date.now() - stats.startTime) / 1000 / 60)} minutes`);
}

// Run the seed script
seedDatabase()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
