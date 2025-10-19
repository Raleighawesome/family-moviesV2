import type {
  TMDBSearchResult,
  TMDBMovieDetails,
  TMDBReleaseDatesResponse,
  TMDBKeywordsResponse,
  TMDBWatchProvidersResponse,
  TMDBCreditsResponse,
} from './types';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';

function getTMDBKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key || key.startsWith('your-')) {
    throw new Error('TMDB_API_KEY is not set or is still the example value. Please add your real TMDB API key to .env.local');
  }
  return key;
}

/**
 * Rate limiting: Simple in-memory rate limiter
 * TMDB allows 50 requests per second
 */
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests = 40; // Stay under limit
  private readonly timeWindow = 1000; // 1 second

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitIfNeeded();
    }

    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

/**
 * Base fetch wrapper with error handling and rate limiting
 */
async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  await rateLimiter.waitIfNeeded();

  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.append('api_key', getTMDBKey());

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    const error = await response.json().catch(() => ({ status_message: 'Unknown error' }));
    throw new Error(`TMDB API Error: ${error.status_message || response.statusText}`);
  }

  return response.json();
}

/**
 * Search for movies by title
 */
export async function searchMovies(
  query: string,
  year?: number,
  page: number = 1
): Promise<TMDBSearchResult> {
  const params: Record<string, string> = {
    query,
    page: page.toString(),
    include_adult: 'false',
  };

  if (year) {
    params.year = year.toString();
  }

  return tmdbFetch<TMDBSearchResult>('/search/movie', params);
}

/**
 * Get detailed information about a movie
 */
export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${movieId}`);
}

/**
 * Get release dates and certifications (includes MPAA rating)
 */
export async function getMovieReleaseDates(movieId: number): Promise<TMDBReleaseDatesResponse> {
  return tmdbFetch<TMDBReleaseDatesResponse>(`/movie/${movieId}/release_dates`);
}

/**
 * Extract US MPAA rating from release dates
 */
export function extractMPAARating(releaseDates: TMDBReleaseDatesResponse): string | null {
  const usRelease = releaseDates.results.find(r => r.iso_3166_1 === 'US');

  if (!usRelease) return null;

  // Look for theatrical release (type 3) or other releases with certification
  const certification = usRelease.release_dates.find(rd => rd.certification);

  return certification?.certification || null;
}

/**
 * Get movie keywords
 */
export async function getMovieKeywords(movieId: number): Promise<TMDBKeywordsResponse> {
  return tmdbFetch<TMDBKeywordsResponse>(`/movie/${movieId}/keywords`);
}

/**
 * Get watch providers (streaming services)
 */
export async function getMovieWatchProviders(movieId: number): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch<TMDBWatchProvidersResponse>(`/movie/${movieId}/watch/providers`);
}

/**
 * Get movie credits (cast and crew)
 */
export async function getMovieCredits(movieId: number): Promise<TMDBCreditsResponse> {
  return tmdbFetch<TMDBCreditsResponse>(`/movie/${movieId}/credits`);
}

/**
 * Get all movie data in one go (combines multiple API calls)
 */
export async function getCompleteMovieData(movieId: number) {
  const [details, releaseDates, keywords, watchProviders, credits] = await Promise.all([
    getMovieDetails(movieId),
    getMovieReleaseDates(movieId),
    getMovieKeywords(movieId),
    getMovieWatchProviders(movieId),
    getMovieCredits(movieId),
  ]);

  return {
    details,
    releaseDates,
    mpaaRating: extractMPAARating(releaseDates),
    keywords,
    watchProviders,
    credits,
  };
}

/**
 * Discover popular movies with filtering
 */
export async function discoverMovies(
  page: number = 1,
  options?: {
    familyFriendly?: boolean;
    certifications?: string[];
    maxRuntime?: number;
  }
): Promise<TMDBSearchResult> {
  const params: Record<string, string> = {
    page: page.toString(),
    include_adult: 'false',
    sort_by: 'popularity.desc',
    'vote_count.gte': '100', // Only movies with at least 100 votes
  };

  // Add family-friendly filters if requested
  if (options?.familyFriendly) {
    // Filter by genres that are typically family-friendly
    // 16: Animation, 10751: Family, 12: Adventure, 35: Comedy, 14: Fantasy, 28: Action
    params['with_genres'] = '16|10751|12|35|14';

    // Maximum runtime
    if (options.maxRuntime) {
      params['with_runtime.lte'] = options.maxRuntime.toString();
    }

    // Exclude specific genres that tend to be non-family-friendly
    // 27: Horror, 53: Thriller, 80: Crime, 10752: War
    params['without_genres'] = '27|53|80|10752';
  }

  return tmdbFetch<TMDBSearchResult>('/discover/movie', params);
}

/**
 * Discover movies by specific genre (useful for family content)
 */
export async function discoverByGenre(
  genreId: number,
  page: number = 1
): Promise<TMDBSearchResult> {
  return tmdbFetch<TMDBSearchResult>('/discover/movie', {
    page: page.toString(),
    include_adult: 'false',
    sort_by: 'popularity.desc',
    'vote_count.gte': '50',
    with_genres: genreId.toString(),
  });
}

/**
 * Helper to build TMDB image URLs
 */
export function getTMDBImageUrl(path: string | null, size: 'original' | 'w500' | 'w200' = 'w500'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
