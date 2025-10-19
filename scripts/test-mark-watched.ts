import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { markWatched } from '../server/tools/mark-watched';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath, override: true });

const householdId = '11111111-1111-1111-1111-111111111111';

async function testMarkWatched() {
  console.log('🧪 Testing mark_watched tool...\n');

  try {
    // Test: Mark "Despicable Me" as watched on Oct 17, 2025 with rating of 5
    const result = await markWatched(
      {
        tmdb_id: 20662, // Despicable Me
        rating: 5,
        watched_at: '2025-10-17T00:00:00Z',
        notes: 'Test entry - watched on Oct 17',
      },
      householdId
    );

    console.log('✅ Result:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMarkWatched();
