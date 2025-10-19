import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '.env.local');
const result = config({ path: envPath, override: true });

async function test() {
  console.log('Loaded vars:', Object.keys(result.parsed || {}).length);
  console.log('TMDB_API_KEY:', process.env.TMDB_API_KEY);

  const TMDB_API_KEY = process.env.TMDB_API_KEY!;
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=Frozen&include_adult=false`;

  console.log('Testing URL...');

  const response = await fetch(url);
  const data = await response.json();

  console.log('Response status:', response.status);
  console.log('Results count:', data.results?.length || 0);
  if (data.results && data.results.length > 0) {
    console.log('First result:', data.results[0].title, data.results[0].id);
  }
}

test().catch(console.error);
