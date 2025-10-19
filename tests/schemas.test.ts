import { describe, it, expect } from 'vitest';
import {
  tmdbSearchSchema,
  addToQueueSchema,
  recommendSchema,
  markWatchedSchema,
} from '@/server/tools/types';

describe('Tool Schemas', () => {
  describe('tmdbSearchSchema', () => {
    it('should validate valid search input', () => {
      const validInput = {
        query: 'The Lion King',
        year: 1994,
      };

      const result = tmdbSearchSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept query without year', () => {
      const input = {
        query: 'Toy Story',
      };

      const result = tmdbSearchSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const input = {
        query: '',
      };

      const result = tmdbSearchSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid year', () => {
      const input = {
        query: 'Test Movie',
        year: -1,
      };

      const result = tmdbSearchSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject year too far in future', () => {
      const input = {
        query: 'Test Movie',
        year: 2101, // Max is 2100
      };

      const result = tmdbSearchSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('addToQueueSchema', () => {
    it('should validate valid queue input', () => {
      const validInput = {
        tmdb_id: 550,
      };

      const result = addToQueueSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject negative tmdb_id', () => {
      const input = {
        tmdb_id: -1,
      };

      const result = addToQueueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject zero tmdb_id', () => {
      const input = {
        tmdb_id: 0,
      };

      const result = addToQueueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing tmdb_id', () => {
      const input = {};

      const result = addToQueueSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('recommendSchema', () => {
    it('should validate with default limit', () => {
      const input = {};

      const result = recommendSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should validate with custom limit', () => {
      const input = {
        limit: 10,
      };

      const result = recommendSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject limit below minimum', () => {
      const input = {
        limit: 0,
      };

      const result = recommendSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit above maximum', () => {
      const input = {
        limit: 25,
      };

      const result = recommendSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('markWatchedSchema', () => {
    it('should validate with just tmdb_id', () => {
      const input = {
        tmdb_id: 1593,
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with rating', () => {
      const input = {
        tmdb_id: 1593,
        rating: 5,
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate with watched_at datetime', () => {
      const input = {
        tmdb_id: 1593,
        rating: 4,
        watched_at: '2025-08-08T00:00:00Z',
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject rating below 1', () => {
      const input = {
        tmdb_id: 1593,
        rating: 0,
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const input = {
        tmdb_id: 1593,
        rating: 6,
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime format', () => {
      const input = {
        tmdb_id: 1593,
        watched_at: 'August 8th, 2025',
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject negative tmdb_id', () => {
      const input = {
        tmdb_id: -1,
      };

      const result = markWatchedSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
