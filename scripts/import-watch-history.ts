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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

if (!process.env.TMDB_API_KEY || !process.env.OPENAI_API_KEY) {
  console.error('❌ Missing required API keys in environment');
  console.error('Please ensure TMDB_API_KEY and OPENAI_API_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HOUSEHOLD_ID = '11111111-1111-1111-1111-111111111111';

interface CSVRow {
  id?: string;
  title: string;
  date_watched: string;
  family_rating: string;
  notes: string;
  parent_feedback?: string;
  created_at?: string;
  watch_dates?: string;
  household_id?: string;
  profile_id?: string;
  tmdb_id?: string;
}

interface TMDBSearchResult {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
}

async function searchTMDB(title: string): Promise<TMDBSearchResult | null> {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}&include_adult=false`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.results && data.results.length > 0) {
    return data.results[0];
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

  // Fetch complete movie data from TMDB
  const movieData = await getCompleteMovieData(tmdbId);
  const normalizedMovie = normalizeTMDBMovie(
    movieData.details,
    movieData.mpaaRating,
    movieData.keywords.keywords?.map(k => k.name) || []
  );

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
    console.error(`Failed to insert movie ${normalizedMovie.title}:`, error.message);
    return false;
  }

  console.log(`  ✅ Added movie to database`);
  return true;
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

    // Skip if no title
    if (!title || title.trim() === '') {
      skipped++;
      continue;
    }

    try {
      // Search for movie on TMDB
      console.log(`🔍 Searching for: ${title}`);
      const searchResult = await searchTMDB(title);

      if (!searchResult) {
        console.log(`  ❌ Not found on TMDB\n`);
        skipped++;
        continue;
      }

      console.log(`  ✓ Found: ${searchResult.title} (${searchResult.release_date?.substring(0, 4) || 'N/A'})`);

      // Ensure movie exists in database
      await ensureMovieExists(searchResult.id);

      // Parse rating (convert to 10-star scale if needed)
      let rating: number | null = null;
      if (family_rating && family_rating.trim() !== '') {
        const parsedRating = parseFloat(family_rating);
        if (!isNaN(parsedRating)) {
          // If rating is 0-5, scale to 0-10
          rating = parsedRating <= 5 ? parsedRating * 2 : parsedRating;
          rating = Math.min(10, Math.max(1, Math.round(rating)));
        }
      }

      // Parse watch date - handle various formats
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
        tmdb_id: searchResult.id,
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
          tmdb_id: searchResult.id,
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
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📝 Total: ${records.length}`);
}

// Get CSV path from command line argument
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: tsx scripts/import-watch-history.ts <path-to-csv>');
  process.exit(1);
}

importWatchHistory(csvPath).catch(console.error);
