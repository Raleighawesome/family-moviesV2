import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCompleteMovieData } from '../lib/tmdb/client';
import { normalizeTMDBMovie } from '../lib/tmdb/normalize';
import { generateMovieEmbedding, embeddingToVector } from '../lib/openai/embeddings';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local (relative to project root)
const envPath = resolve(__dirname, '../.env.local');
const result = config({ path: envPath, override: true });

if (result.error) {
  console.error('Error loading .env.local:', result.error);
} else {
  console.log(`✓ Loaded ${Object.keys(result.parsed || {}).length} environment variables from ${envPath}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TMDB_API_KEY = process.env.TMDB_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TMDB_API_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  console.error('TMDB_API_KEY:', TMDB_API_KEY ? '✓' : '✗');
  console.error('\nPlease ensure these are set in .env.local');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY in environment');
  console.error('This is required to generate embeddings for new movies');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';

interface CSVRow {
  title: string;
  date_watched: string;
  family_rating: string;
  notes: string;
}

async function searchTMDB(title: string): Promise<number | null> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.results && data.results.length > 0) {
    return data.results[0].id;
  }

  return null;
}

async function ensureMovieExists(tmdbId: number): Promise<boolean> {
  // Check if movie already exists
  const { data: existing } = await supabase
    .from('movies')
    .select('tmdb_id')
    .eq('tmdb_id', tmdbId)
    .maybeSingle();

  if (existing) {
    return true;
  }

  console.log(`  📥 Fetching movie details from TMDB...`);

  try {
    // Fetch complete movie data from TMDB
    const movieData = await getCompleteMovieData(tmdbId);
    const normalizedMovie = normalizeTMDBMovie(
      movieData.details,
      movieData.mpaaRating,
      movieData.keywords.keywords?.map(k => k.name) || []
    );

    console.log(`  🧠 Generating embedding...`);

    // Generate embedding
    const embedding = await generateMovieEmbedding({
      title: normalizedMovie.title,
      overview: normalizedMovie.overview || '',
      genres: normalizedMovie.genres,
      keywords: normalizedMovie.keywords,
    });

    console.log(`  💾 Adding to database...`);

    // Insert into database
    const { error } = await supabase
      .from('movies')
      .insert({
        ...normalizedMovie,
        embedding: embeddingToVector(embedding),
      });

    if (error) {
      console.error(`  ❌ Failed to insert movie: ${error.message}`);
      return false;
    }

    console.log(`  ✅ Added "${normalizedMovie.title}" to database`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error fetching/adding movie:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function importWatchHistory(csvPath: string) {
  console.log('📚 Starting watch history import...\n');

  // Read and parse CSV
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];

  console.log(`Found ${records.length} records in CSV\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    const { title, date_watched, family_rating, notes } = record;

    if (!title || title.trim() === '') {
      skipped++;
      continue;
    }

    try {
      console.log(`🔍 Processing: ${title}`);

      // Search for movie on TMDB to get the ID
      const tmdbId = await searchTMDB(title);

      if (!tmdbId) {
        console.log(`  ❌ Not found on TMDB\n`);
        skipped++;
        continue;
      }

      // Ensure movie exists in database (add if not found)
      const movieExists = await ensureMovieExists(tmdbId);

      if (!movieExists) {
        console.log(`  ❌ Could not add movie to database\n`);
        errors++;
        continue;
      }

      // Get the movie title for confirmation
      const { data: movie } = await supabase
        .from('movies')
        .select('title')
        .eq('tmdb_id', tmdbId)
        .single();

      console.log(`  ✓ Movie ready: ${movie?.title || title}`);

      // Parse rating (convert to 10-star scale if needed)
      let rating: number | null = null;
      if (family_rating && family_rating.trim() !== '') {
        const parsedRating = parseFloat(family_rating);
        if (!isNaN(parsedRating)) {
          rating = parsedRating <= 5 ? parsedRating * 2 : parsedRating;
          rating = Math.min(10, Math.max(1, Math.round(rating)));
        }
      }

      // Parse watch date
      let watchedAt: string;
      if (date_watched && date_watched.trim() !== '') {
        try {
          watchedAt = new Date(date_watched).toISOString();
        } catch {
          watchedAt = new Date().toISOString();
        }
      } else {
        watchedAt = new Date().toISOString();
      }

      // Insert watch record
      const { error: watchError } = await supabase.from('watches').insert({
        household_id: HOUSEHOLD_ID,
        tmdb_id: tmdbId,
        watched_at: watchedAt,
        notes: notes?.trim() || null,
        rewatch: false,
        profile_id: null,
      });

      if (watchError) {
        console.log(`  ❌ Failed to insert watch: ${watchError.message}\n`);
        errors++;
        continue;
      }

      // Insert rating if provided
      if (rating !== null) {
        const { error: ratingError } = await supabase.from('ratings').insert({
          household_id: HOUSEHOLD_ID,
          tmdb_id: tmdbId,
          rating,
          profile_id: null,
        });

        if (ratingError && !ratingError.message.includes('duplicate')) {
          console.log(`  ⚠️  Failed to insert rating: ${ratingError.message}`);
        }
      }

      console.log(`  ✅ Imported (rating: ${rating || 'none'}, date: ${watchedAt.substring(0, 10)})\n`);
      imported++;

      // Rate limiting - wait 250ms between requests
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error) {
      console.error(`  ❌ Error processing ${title}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`  ✅ Imported: ${imported}`);
  console.log(`  ⏭️  Skipped (not found on TMDB): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📝 Total: ${records.length}`);
}

// Get CSV path from command line argument
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: tsx scripts/import-watch-history-simple.ts <path-to-csv>');
  process.exit(1);
}

importWatchHistory(csvPath).catch(console.error);
