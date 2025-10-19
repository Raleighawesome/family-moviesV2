import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath, override: true });

async function searchDespicableMe() {
  const TMDB_API_KEY = process.env.TMDB_API_KEY!;

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent('Despicable Me')}`;

  const response = await fetch(url);
  const data = await response.json();

  console.log('🔍 Search results for "Despicable Me":\n');

  data.results?.slice(0, 5).forEach((movie: any) => {
    console.log(`ID: ${movie.id} - ${movie.title} (${movie.release_date?.substring(0, 4)})`);
  });
}

searchDespicableMe();
