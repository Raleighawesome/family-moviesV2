import type { TMDBMovieDetails, TMDBWatchProvidersResponse } from './types';
import { getTMDBImageUrl } from './client';

/**
 * Database movie record type (matches our Supabase schema)
 */
export interface DatabaseMovie {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  runtime: number | null;
  mpaa: string | null;
  genres: string[];
  keywords: string[];
  popularity: number | null;
  last_fetched_at?: string;
}

/**
 * Database movie provider record type
 */
export interface DatabaseMovieProvider {
  tmdb_id: number;
  region: string;
  providers: {
    flatrate?: Array<{
      provider_id: number;
      provider_name: string;
      logo_path: string | null;
    }>;
    rent?: Array<{
      provider_id: number;
      provider_name: string;
      logo_path: string | null;
    }>;
    buy?: Array<{
      provider_id: number;
      provider_name: string;
      logo_path: string | null;
    }>;
  };
  updated_at?: string;
}

/**
 * Convert TMDB movie details to our database format
 */
export function normalizeTMDBMovie(
  details: TMDBMovieDetails,
  mpaaRating: string | null,
  keywords: string[]
): DatabaseMovie {
  // Extract year from release_date (format: YYYY-MM-DD)
  const year = details.release_date
    ? parseInt(details.release_date.split('-')[0], 10)
    : null;

  return {
    tmdb_id: details.id,
    title: details.title,
    year,
    poster_path: details.poster_path,
    overview: details.overview || null,
    runtime: details.runtime,
    mpaa: mpaaRating,
    genres: details.genres.map(g => g.name),
    keywords,
    popularity: details.popularity,
    last_fetched_at: new Date().toISOString(),
  };
}

/**
 * Convert TMDB watch providers to our database format
 */
export function normalizeTMDBProviders(
  tmdbId: number,
  region: string,
  watchProviders: TMDBWatchProvidersResponse
): DatabaseMovieProvider | null {
  const regionData = watchProviders.results[region];

  if (!regionData) {
    return null;
  }

  const normalizeProvider = (provider: any) => ({
    provider_id: provider.provider_id,
    provider_name: provider.provider_name,
    logo_path: provider.logo_path,
  });

  return {
    tmdb_id: tmdbId,
    region,
    providers: {
      flatrate: regionData.flatrate?.map(normalizeProvider),
      rent: regionData.rent?.map(normalizeProvider),
      buy: regionData.buy?.map(normalizeProvider),
    },
    updated_at: new Date().toISOString(),
  };
}

/**
 * Get full poster URL or null
 */
export function getFullPosterUrl(posterPath: string | null): string | null {
  return getTMDBImageUrl(posterPath, 'w500');
}

/**
 * Get full backdrop URL or null
 */
export function getFullBackdropUrl(backdropPath: string | null): string | null {
  return getTMDBImageUrl(backdropPath, 'original');
}

/**
 * Extract directors from credits
 */
export function extractDirectors(credits: any): string[] {
  if (!credits?.crew) return [];

  return credits.crew
    .filter((person: any) => person.job === 'Director')
    .map((person: any) => person.name);
}

/**
 * Extract main cast (top N actors)
 */
export function extractMainCast(credits: any, limit = 5): string[] {
  if (!credits?.cast) return [];

  return credits.cast
    .slice(0, limit)
    .map((person: any) => person.name);
}

/**
 * Format runtime as human-readable string (e.g., "2h 15m")
 */
export function formatRuntime(minutes: number | null): string {
  if (!minutes) return 'Unknown';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
}

/**
 * Check if a movie is appropriate for family based on MPAA rating
 */
export function isFamilyFriendly(mpaa: string | null, allowedRatings: string[]): boolean {
  if (!mpaa) return false;
  return allowedRatings.includes(mpaa);
}

/**
 * Check if movie matches blocked keywords
 */
export function hasBlockedKeywords(movieKeywords: string[], blockedKeywords: string[]): boolean {
  return movieKeywords.some(keyword =>
    blockedKeywords.some(blocked =>
      keyword.toLowerCase().includes(blocked.toLowerCase())
    )
  );
}
