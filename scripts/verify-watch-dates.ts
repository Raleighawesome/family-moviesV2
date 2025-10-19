import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath, override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const householdId = '11111111-1111-1111-1111-111111111111';

interface CSVRow {
  id: string;
  title: string;
  date_watched: string;
  family_rating: string;
  notes: string;
  parent_feedback: string;
  created_at: string;
  watch_dates: string;
  household_id: string;
  profile_id: string;
  tmdb_id: string;
}

async function verifyWatchDates() {
  console.log('✅ Verifying watch dates match CSV...\n');

  // Read CSV file
  const csvPath = resolve(__dirname, '../movies_log_rows.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as CSVRow[];

  let matchCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  console.log('Checking movies with dates in CSV:\n');

  for (const row of records) {
    const title = row.title;
    const csvDate = row.date_watched;

    if (!csvDate) {
      continue;
    }

    // Find movie in database by title
    const { data: movies } = await supabase
      .from('movies')
      .select('tmdb_id, title')
      .ilike('title', title)
      .limit(1);

    if (!movies || movies.length === 0) {
      console.log(`⚠️  Movie not in DB: "${title}"`);
      missingCount++;
      continue;
    }

    const tmdbId = movies[0].tmdb_id;

    // Get all watch records for this movie
    const { data: watches } = await supabase
      .from('watches')
      .select('id, watched_at')
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdbId)
      .order('watched_at', { ascending: true });

    if (!watches || watches.length === 0) {
      console.log(`⚠️  No watch record: "${title}"`);
      missingCount++;
      continue;
    }

    // Check if any watch matches the CSV date
    const csvDateStr = new Date(csvDate).toISOString().split('T')[0];
    const matchingWatch = watches.find(w => {
      const watchDateStr = new Date(w.watched_at).toISOString().split('T')[0];
      return watchDateStr === csvDateStr;
    });

    if (matchingWatch) {
      matchCount++;
    } else {
      console.log(`❌ MISMATCH: "${title}"`);
      console.log(`   CSV date: ${csvDateStr}`);
      console.log(`   DB dates: ${watches.map(w => new Date(w.watched_at).toISOString().split('T')[0]).join(', ')}`);
      mismatchCount++;
    }
  }

  console.log('\n📊 Verification Summary:');
  console.log(`✅ Matching: ${matchCount}`);
  console.log(`❌ Mismatches: ${mismatchCount}`);
  console.log(`⚠️  Missing: ${missingCount}`);
  console.log(`📝 Total CSV records with dates: ${records.filter(r => r.date_watched).length}`);
}

verifyWatchDates().catch(console.error);
