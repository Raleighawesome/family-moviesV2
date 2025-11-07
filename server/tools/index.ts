/**
 * Server-Side AI Tools
 *
 * These functions are designed to be called by the AI chat system.
 * Each tool performs a specific movie-related operation and returns structured data.
 *
 * All tools require:
 * - Input validation via Zod schemas
 * - householdId for multi-tenancy
 * - Optional profileId for user-specific operations
 *
 * Tools respect household preferences (allowed ratings, max runtime, blocked keywords)
 * and enforce RLS policies at the database level.
 */

export * from './types';
export { tmdbSearch } from './tmdb-search';
export { addToQueue } from './add-to-queue';
export { recommend } from './recommend';
export { markWatched } from './mark-watched';
export { getStreaming } from './get-streaming';
export { updateRating } from './update-rating';

// Tool metadata for AI SDK
export const toolDefinitions = {
  tmdb_search: {
    description: 'Search for movies by title and optional year. Returns 3-8 candidates filtered by household content preferences (allowed ratings, max runtime).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The movie title to search for',
        },
        year: {
          type: 'number',
          description: 'Optional release year to narrow the search',
        },
      },
      required: ['query'],
    },
  },

  add_to_queue: {
    description: 'Add a movie to the household queue. Fetches movie metadata from TMDB, generates embeddings, and saves to database if not already present.',
    parameters: {
      type: 'object',
      properties: {
        tmdb_id: {
          type: 'number',
          description: 'The TMDB ID of the movie to add',
        },
      },
      required: ['tmdb_id'],
    },
  },

  recommend: {
    description: 'Get personalized movie recommendations based on household viewing history and ratings. Uses vector similarity if ratings exist, otherwise returns popular movies filtered by preferences.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recommendations to return (1-24, default 10)',
          default: 10,
        },
        query_description: {
          type: 'string',
          description: 'Free-form natural language describing the desired recommendations',
        },
      },
    },
  },

  mark_watched: {
    description: 'Mark a movie as watched with optional rating (1-10 stars), personal notes, and watch date. Can be used multiple times for the same movie to track rewatches. Updates watch history and if rated 8+ stars, refreshes the household taste vector for better recommendations.',
    parameters: {
      type: 'object',
      properties: {
        tmdb_id: {
          type: 'number',
          description: 'The TMDB ID of the movie that was watched',
        },
        rating: {
          type: 'number',
          description: 'Optional rating from 1-10 stars',
          minimum: 1,
          maximum: 10,
        },
        watched_at: {
          type: 'string',
          description: 'ISO 8601 datetime when the movie was watched (defaults to now)',
        },
        notes: {
          type: 'string',
          description: 'Personal notes or comments about the movie (max 500 characters)',
        },
      },
      required: ['tmdb_id'],
    },
  },

  get_streaming: {
    description: 'Get streaming availability for a movie (where to watch: stream, rent, or buy). Returns available streaming services based on household region.',
    parameters: {
      type: 'object',
      properties: {
        tmdb_id: {
          type: 'number',
          description: 'The TMDB ID of the movie',
        },
      },
      required: ['tmdb_id'],
    },
  },

  update_rating: {
    description: 'Update the rating for a movie that the household has ALREADY watched. Use this when the user wants to change or add a rating to a previously watched movie WITHOUT creating a new watch record. Does NOT affect the watch date.',
    parameters: {
      type: 'object',
      properties: {
        tmdb_id: {
          type: 'number',
          description: 'The TMDB ID of the movie to rate',
        },
        rating: {
          type: 'number',
          description: 'New rating from 1-10 stars',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['tmdb_id', 'rating'],
    },
  },
} as const;
