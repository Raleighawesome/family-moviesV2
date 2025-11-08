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
  queue_item_id?: number;
}

// ============================================================================
// Recommend Tool
// ============================================================================

export const recommendSchema = z.object({
  limit: z.number().int().min(1).max(24).default(10),
  // Optional filters inferred from natural language
  year_min: z.number().int().optional(),
  year_max: z.number().int().optional(),
  genres: z.array(z.string()).optional(),
  min_popularity: z.number().optional(),
  min_vote_average: z.number().min(0).max(10).optional(),
  streaming_only: z.boolean().optional(),
  query_description: z
    .string()
    .min(1)
    .max(2000)
    .optional()
    .describe('Free-form natural language describing the desired recommendations'),
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
  overview?: string | null;
  vote_average?: number | null;
  distance?: number; // Similarity score (lower is more similar)
  reason?: string; // One-line rationale referencing Family Settings
  providers?: {
    flatrate?: Array<{ provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number }>;
    rent?: Array<{ provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number }>;
    buy?: Array<{ provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number }>;
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
  watch_id?: number;
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
// Update Watch Tool
// ============================================================================

export const updateWatchSchema = z
  .object({
    tmdb_id: z.number().int().positive('TMDB ID must be a positive number'),
    watch_id: z.number().int().positive('Watch ID must be a positive number').optional(),
    original_watched_at: z
      .string()
      .datetime()
      .optional()
      .describe('Original watched_at timestamp to identify a specific watch entry'),
    watched_at: z
      .string()
      .datetime()
      .optional()
      .describe('New ISO 8601 datetime for the watch entry'),
    notes: z
      .union([z.string().max(500), z.null()])
      .optional()
      .describe('Updated personal notes. Use null or an empty string to clear the note.'),
    rewatch: z
      .boolean()
      .optional()
      .describe('Whether this watch entry should be marked as a rewatch'),
  })
  .superRefine((data, ctx) => {
    if (data.watched_at === undefined && data.notes === undefined && data.rewatch === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update (watched_at, notes, or rewatch).',
        path: ['watched_at'],
      });
    }
  });

export type UpdateWatchInput = z.infer<typeof updateWatchSchema>;

export interface UpdateWatchResult {
  success: boolean;
  watch: {
    id: number;
    tmdb_id: number;
    watched_at: string;
    notes: string | null;
    rewatch: boolean | null;
  };
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
