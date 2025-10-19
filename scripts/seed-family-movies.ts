import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getCompleteMovieData } from '../lib/tmdb/client';
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

/**
 * Popular family-friendly movies (G and PG rated)
 * These are well-known movies that families typically enjoy
 */
const FAMILY_MOVIE_IDS = [
  // Disney Classics
  8587,   // The Lion King (1994)
  862,    // Toy Story (1995)
  863,    // Toy Story 2 (1999)
  10681,  // WALL-E (2008)
  9806,   // The Incredibles (2004)
  585,    // Monsters, Inc. (2001)
  12,     // Finding Nemo (2003)
  14160,  // Up (2009)
  10193,  // Toy Story 3 (2010)
  49026,  // The Lego Movie (2014)

  // More Disney/Pixar
  129,    // Spirited Away (2001)
  10020,  // Ratatouille (2007)
  9487,   // A Bug's Life (1998)
  2062,   // Ratatouille (2007)
  920,    // Cars (2006)
  13053,  // Despicable Me (2010)
  260514, // Moana (2016)
  109445, // Frozen (2013)
  166424, // Fantastic Mr. Fox (2009)

  // Live Action Family
  771,    // Home Alone (1990)
  118,    // The Lord of the Rings: The Fellowship of the Ring (2001)
  1593,   // Night at the Museum (2006)
  13972,  // Happy Feet (2006)
  10191,  // How to Train Your Dragon (2010)
  82690,  // Wreck-It Ralph (2012)
  177572, // Big Hero 6 (2014)
  354912, // Coco (2017)
  508943, // Luca (2021)
  508947, // Turning Red (2022)
];

async function seedMovie(tmdbId: number): Promise<boolean> {
  try {
    // Check if movie already exists
    const { data: existing } = await supabase
      .from('movies')
      .select('tmdb_id')
      .eq('tmdb_id', tmdbId)
      .single();

    if (existing) {
      console.log(`  ⏭️  Movie ${tmdbId} already exists, skipping`);
      return false;
    }

    console.log(`  📥 Fetching movie ${tmdbId} from TMDB...`);

    // Fetch complete movie data from TMDB
    const movieData = await getCompleteMovieData(tmdbId);
    const normalizedMovie = normalizeTMDBMovie(
      movieData.details,
      movieData.mpaaRating,
      movieData.keywords.keywords.map(k => k.name) // Extract keyword names from TMDBKeywordsResponse
    );

    console.log(`  🎬 Processing: ${normalizedMovie.title} (${normalizedMovie.year}) - ${normalizedMovie.mpaa}`);

    // Only add G and PG movies
    if (normalizedMovie.mpaa && !['G', 'PG'].includes(normalizedMovie.mpaa)) {
      console.log(`  ⚠️  Skipping ${normalizedMovie.title} - rating is ${normalizedMovie.mpaa}, not G or PG`);
      return false;
    }

    // Generate embedding
    console.log(`  🧠 Generating embedding...`);
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
      console.error(`  ❌ Failed to insert ${normalizedMovie.title}:`, error);
      return false;
    }

    console.log(`  ✅ Added: ${normalizedMovie.title}`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error processing movie ${tmdbId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function seedDatabase() {
  console.log('🌱 Starting to seed family movies database...\n');
  console.log(`📊 Total movies to process: ${FAMILY_MOVIE_IDS.length}\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const tmdbId of FAMILY_MOVIE_IDS) {
    const result = await seedMovie(tmdbId);
    if (result === true) {
      successCount++;
    } else if (result === false) {
      // Check if it was skipped (already exists) or failed
      const { data: existing } = await supabase
        .from('movies')
        .select('tmdb_id')
        .eq('tmdb_id', tmdbId)
        .single();

      if (existing) {
        skipCount++;
      } else {
        errorCount++;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✨ Seeding complete!');
  console.log(`   ✅ Successfully added: ${successCount}`);
  console.log(`   ⏭️  Skipped (already exist): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total in database: ${successCount + skipCount}`);
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
