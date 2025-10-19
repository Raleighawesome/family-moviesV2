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

async function fixWatchDates() {
  console.log('🔧 Fixing watch dates from CSV...\n');

  // Read CSV file
  const csvPath = resolve(__dirname, '../movies_log_rows.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as CSVRow[];

  console.log(`📄 Found ${records.length} records in CSV\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const row of records) {
    const title = row.title;
    const csvDate = row.date_watched;

    if (!csvDate) {
      console.log(`⏭️  Skipping "${title}" - no date_watched in CSV`);
      skippedCount++;
      continue;
    }

    // Find movie in database by title
    const { data: movies } = await supabase
      .from('movies')
      .select('tmdb_id, title')
      .ilike('title', title)
      .limit(1);

    if (!movies || movies.length === 0) {
      console.log(`❌ Movie not found: "${title}"`);
      errorCount++;
      continue;
    }

    const tmdbId = movies[0].tmdb_id;

    // Get the watch record
    const { data: watches } = await supabase
      .from('watches')
      .select('id, watched_at')
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdbId)
      .order('watched_at', { ascending: false })
      .limit(1);

    if (!watches || watches.length === 0) {
      console.log(`❌ No watch record found for: "${title}"`);
      errorCount++;
      continue;
    }

    const watchId = watches[0].id;
    const currentDate = new Date(watches[0].watched_at);
    const csvDateObj = new Date(csvDate);

    // Compare dates (ignore time component)
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const csvDateStr = csvDateObj.toISOString().split('T')[0];

    if (currentDateStr === csvDateStr) {
      console.log(`✅ "${title}" - Date already correct: ${csvDateStr}`);
      continue;
    }

    // Update the watch date
    const { error } = await supabase
      .from('watches')
      .update({ watched_at: csvDateObj.toISOString() })
      .eq('id', watchId);

    if (error) {
      console.log(`❌ Error updating "${title}": ${error.message}`);
      errorCount++;
      continue;
    }

    console.log(`🔄 Updated "${title}": ${currentDateStr} → ${csvDateStr}`);
    updatedCount++;
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Updated: ${updatedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

fixWatchDates().catch(console.error);
