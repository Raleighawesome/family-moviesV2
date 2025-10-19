import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath, override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

async function importWatchHistory(csvPath: string, targetHouseholdId: string) {
  console.log('📚 Starting watch history import from CSV...\n');
  console.log(`Target household: ${targetHouseholdId}\n`);

  // Read and parse CSV
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];

  console.log(`Found ${records.length} watch records in CSV\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Group by title to avoid duplicates and handle rewatches
  const movieGroups = new Map<string, CSVRow[]>();

  for (const record of records) {
    if (!movieGroups.has(record.title)) {
      movieGroups.set(record.title, []);
    }
    movieGroups.get(record.title)!.push(record);
  }

  console.log(`Processing ${movieGroups.size} unique movie titles...\n`);

  for (const [title, watches] of movieGroups) {
    console.log(`🎬 Processing: ${title} (${watches.length} watch${watches.length > 1 ? 'es' : ''})`);

    try {
      // Get the primary watch record (usually the first or one with rating)
      const primaryWatch = watches.find(w => w.family_rating) || watches[0];

      if (!primaryWatch || !primaryWatch.title.trim()) {
        console.log('  ⏭️  Skipping - no valid data\n');
        skipped++;
        continue;
      }

      // Use the import-watch-history script's logic
      // This will search TMDB, add the movie if needed, and create watch records
      const { execSync } = await import('child_process');

      // Create a temporary CSV for this movie
      const tempCsvPath = resolve(__dirname, `../temp_${Date.now()}.csv`);
      const tempCsvContent = `title,date_watched,family_rating,notes\n"${primaryWatch.title.replace(/"/g, '""')}","${primaryWatch.date_watched}","${primaryWatch.family_rating}","${(primaryWatch.notes || '').replace(/"/g, '""')}"`;

      const fs = await import('fs');
      fs.writeFileSync(tempCsvPath, tempCsvContent);

      try {
        // Run the existing import script for this single movie
        execSync(`tsx ${resolve(__dirname, './import-watch-history.ts')} "${tempCsvPath}"`, {
          stdio: 'inherit',
        });

        imported++;
        console.log(`  ✅ Imported successfully\n`);
      } catch (error) {
        console.error(`  ❌ Failed to import: ${error}\n`);
        errors++;
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tempCsvPath);
        } catch {}
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  ❌ Error processing ${title}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`  ✅ Imported: ${imported}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📝 Total: ${movieGroups.size}`);
}

// Get CSV path from command line
const csvPath = process.argv[2] || resolve(__dirname, '../movies_log_rows.csv');
const householdId = process.argv[3] || '11111111-1111-1111-1111-111111111111';

if (!csvPath) {
  console.error('Usage: tsx scripts/import-csv-watch-history.ts <path-to-csv> [household-id]');
  process.exit(1);
}

importWatchHistory(csvPath, householdId).catch(console.error);
