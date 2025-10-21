/**
 * Backfill TMDB vote_average and vote_count for movies.
 *
 * Usage:
 *   TMDB_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... pnpm tsx scripts/backfill-movie-votes.ts [--limit 500]
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getMovieDetails } from '@/lib/tmdb';

type Args = { limit?: number };

function parseArgs(): Args {
  const args: Args = {};
  const idx = process.argv.indexOf('--limit');
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    if (!isNaN(n) && n > 0) args.limit = n;
  }
  return args;
}

async function main() {
  const { limit = 500 } = parseArgs();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!process.env.TMDB_API_KEY) {
    console.error('Missing TMDB_API_KEY');
    process.exit(1);
  }

  const supabase = createServiceClient();

  console.log(`[backfill] Fetching up to ${limit} movies missing vote stats...`);
  const { data: movies, error } = await supabase
    .from('movies')
    .select('tmdb_id, title, vote_average, vote_count')
    .or('vote_average.is.null,vote_count.is.null')
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('[backfill] Failed to query movies:', error);
    process.exit(1);
  }

  if (!movies || movies.length === 0) {
    console.log('[backfill] Nothing to update.');
    return;
  }

  console.log(`[backfill] Found ${movies.length} movies to update`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of movies) {
    const id = m.tmdb_id as number;
    try {
      const details = await getMovieDetails(id);
      const vote_average = typeof details.vote_average === 'number' ? details.vote_average : null;
      const vote_count = typeof details.vote_count === 'number' ? details.vote_count : null;
      const popularity = typeof (details as any).popularity === 'number' ? (details as any).popularity : null;

      if (vote_average == null && vote_count == null && popularity == null) {
        skipped++;
        continue;
      }

      const { error: upErr } = await supabase
        .from('movies')
        .update({ vote_average, vote_count, popularity, last_fetched_at: new Date().toISOString() })
        .eq('tmdb_id', id);

      if (upErr) {
        failed++;
        console.warn(`[backfill] Update failed for ${id}:`, upErr.message);
      } else {
        updated++;
        if (updated % 20 === 0) console.log(`[backfill] Updated ${updated}/${movies.length}...`);
      }
    } catch (e) {
      failed++;
      console.warn(`[backfill] TMDB fetch failed for ${id}:`, (e as Error).message);
      // small delay on failures to avoid hammering
      await new Promise(r => setTimeout(r, 200));
    }
    // polite pacing
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[backfill] Done. Updated=${updated}, Skipped=${skipped}, Failed=${failed}`);
}

main().catch((e) => {
  console.error('[backfill] Uncaught error:', e);
  process.exit(1);
});

