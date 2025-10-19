import { z } from 'zod';

/**
 * Shared types and Zod schemas for AI tools
 */

// ============================================================================
// TMDB Search Tool
// ============================================================================

export const tmdbSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  year: z.number().int().min(1900).max(2100).optional(),
});

export type TMDBSearchInput = z.infer<typeof tmdbSearchSchema>;

export interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  mpaa: string | null;
  runtime: number | null;
  genres: string[];
}

// ============================================================================
// Add to Queue Tool
// ============================================================================

export const addToQueueSchema = z.object({
  tmdb_id: z.number().int().positive('TMDB ID must be a positive number'),
});

export type AddToQueueInput = z.infer<typeof addToQueueSchema>;

export interface AddToQueueResult {
  success: boolean;
  movie: {
    tmdb_id: number;
    title: string;
    year: number | null;
    poster_path: string | null;
  };
  message: string;
}

// ============================================================================
// Recommend Tool
// ============================================================================

export const recommendSchema = z.object({
  limit: z.number().int().min(1).max(24).default(10),
});

export type RecommendInput = z.infer<typeof recommendSchema>;

export interface RecommendResult {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  mpaa: string | null;
  runtime: number | null;
  genres: string[];
  distance?: number; // Similarity score (lower is more similar)
  providers?: {
    flatrate?: Array<{ provider_name: string; logo_path: string | null }>;
    rent?: Array<{ provider_name: string; logo_path: string | null }>;
    buy?: Array<{ provider_name: string; logo_path: string | null }>;
  };
}

// ============================================================================
// Mark Watched Tool
// ============================================================================

export const markWatchedSchema = z.object({
  tmdb_id: z.number().int().positive('TMDB ID must be a positive number'),
  rating: z.number().int().min(1).max(10).optional().describe('Rating out of 10 stars'),
  watched_at: z.string().datetime().optional().describe('ISO 8601 datetime when the movie was watched (defaults to now)'),
  notes: z.string().max(500).optional().describe('Personal notes or comments about the movie'),
});

export type MarkWatchedInput = z.infer<typeof markWatchedSchema>;

export interface MarkWatchedResult {
  success: boolean;
  movie: {
    tmdb_id: number;
    title: string;
  };
  rating?: number;
  message: string;
}

// ============================================================================
// Get Streaming Tool
// ============================================================================

export const getStreamingSchema = z.object({
  tmdb_id: z.number().int().positive('TMDB ID must be a positive number'),
});

export type GetStreamingInput = z.infer<typeof getStreamingSchema>;

export interface MovieToolContext {
  userId: string;
  householdId: string;
  profileId?: string | null;
}

// ============================================================================
// Update Rating Tool
// ============================================================================

export const updateRatingSchema = z.object({
  tmdb_id: z.number().int().positive('TMDB ID must be a positive number'),
  rating: z.number().int().min(1).max(10).describe('Rating out of 10 stars'),
});

export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;

export interface UpdateRatingResult {
  success: boolean;
  movie: {
    tmdb_id: number;
    title: string;
  };
  rating: number;
  message: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export class ValidationError extends ToolError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ToolError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends ToolError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}
