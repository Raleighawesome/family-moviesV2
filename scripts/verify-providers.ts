#!/usr/bin/env tsx
/**
 * Verify movie_providers table was populated correctly
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verify() {
  // Count total providers
  const { count, error } = await supabase
    .from('movie_providers')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Total movie_providers entries: ${count}`);

  // Get a sample entry
  const { data: sample } = await supabase
    .from('movie_providers')
    .select('tmdb_id, region, providers')
    .limit(1)
    .single();

  if (sample) {
    console.log('\n📄 Sample entry:');
    console.log('TMDB ID:', sample.tmdb_id);
    console.log('Region:', sample.region);
    console.log('Providers:', JSON.stringify(sample.providers, null, 2));
  }

  // Check how many have streaming options
  const { data: allProviders } = await supabase
    .from('movie_providers')
    .select('providers');

  if (allProviders) {
    let withFlatrate = 0;
    let withRent = 0;
    let withBuy = 0;

    allProviders.forEach((entry: any) => {
      const p = entry.providers;
      if (p.flatrate && p.flatrate.length > 0) withFlatrate++;
      if (p.rent && p.rent.length > 0) withRent++;
      if (p.buy && p.buy.length > 0) withBuy++;
    });

    console.log('\n📊 Provider breakdown:');
    console.log(`   ${withFlatrate} movies available to stream`);
    console.log(`   ${withRent} movies available to rent`);
    console.log(`   ${withBuy} movies available to buy`);
  }
}

verify()
  .then(() => {
    console.log('\n✨ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
