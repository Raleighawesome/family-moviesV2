import { describe, it, expect } from 'vitest';
import { normalizeTMDBMovie } from '@/lib/tmdb/normalize';
import type { TMDBMovieDetails } from '@/lib/tmdb/types';

describe('TMDB Normalization', () => {
  describe('normalizeTMDBMovie', () => {
    const mockTMDBDetails: TMDBMovieDetails = {
      id: 550,
      title: 'Fight Club',
      release_date: '1999-10-15',
      poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      overview: 'A ticking-time-bomb insomniac and a slippery soap salesman...',
      runtime: 139,
      genres: [
        { id: 18, name: 'Drama' },
        { id: 53, name: 'Thriller' },
      ],
      popularity: 61.416,
    };

    it('should normalize basic movie details', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, 'R', ['violence', 'psychological']);

      expect(result.tmdb_id).toBe(550);
      expect(result.title).toBe('Fight Club');
      expect(result.year).toBe(1999);
      expect(result.poster_path).toBe('/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg');
      expect(result.overview).toBe('A ticking-time-bomb insomniac and a slippery soap salesman...');
      expect(result.runtime).toBe(139);
      expect(result.popularity).toBe(61.416);
    });

    it('should extract year from release_date', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, null, []);

      expect(result.year).toBe(1999);
    });

    it('should handle missing release_date', () => {
      const detailsWithoutDate = {
        ...mockTMDBDetails,
        release_date: '',
      };

      const result = normalizeTMDBMovie(detailsWithoutDate, null, []);

      expect(result.year).toBeNull();
    });

    it('should extract MPAA rating', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, 'R', []);

      expect(result.mpaa).toBe('R');
    });

    it('should handle missing MPAA rating', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, null, []);

      expect(result.mpaa).toBeNull();
    });

    it('should extract genre names', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, null, []);

      expect(result.genres).toEqual(['Drama', 'Thriller']);
    });

    it('should handle empty genres', () => {
      const detailsWithoutGenres = {
        ...mockTMDBDetails,
        genres: [],
      };

      const result = normalizeTMDBMovie(detailsWithoutGenres, null, []);

      expect(result.genres).toEqual([]);
    });

    it('should include keywords', () => {
      const keywords = ['violence', 'psychological', 'insomnia'];
      const result = normalizeTMDBMovie(mockTMDBDetails, null, keywords);

      expect(result.keywords).toEqual(['violence', 'psychological', 'insomnia']);
    });

    it('should handle empty keywords', () => {
      const result = normalizeTMDBMovie(mockTMDBDetails, null, []);

      expect(result.keywords).toEqual([]);
    });

    it('should handle all null optional fields', () => {
      const minimalDetails: TMDBMovieDetails = {
        id: 123,
        title: 'Test Movie',
        release_date: '',
        poster_path: null,
        overview: null,
        runtime: null,
        genres: [],
        popularity: 0,
      };

      const result = normalizeTMDBMovie(minimalDetails, null, []);

      expect(result.tmdb_id).toBe(123);
      expect(result.title).toBe('Test Movie');
      expect(result.year).toBeNull();
      expect(result.poster_path).toBeNull();
      expect(result.overview).toBeNull();
      expect(result.runtime).toBeNull();
      expect(result.mpaa).toBeNull();
      expect(result.genres).toEqual([]);
      expect(result.keywords).toEqual([]);
    });

    it('should extract year correctly from various date formats', () => {
      const testCases = [
        { date: '2024-12-25', expectedYear: 2024 },
        { date: '1994-06-15', expectedYear: 1994 },
        { date: '2000-01-01', expectedYear: 2000 },
      ];

      testCases.forEach(({ date, expectedYear }) => {
        const details = { ...mockTMDBDetails, release_date: date };
        const result = normalizeTMDBMovie(details, null, []);
        expect(result.year).toBe(expectedYear);
      });
    });

    it('should preserve popularity as number', () => {
      const details = { ...mockTMDBDetails, popularity: 123.456 };
      const result = normalizeTMDBMovie(details, null, []);

      expect(result.popularity).toBe(123.456);
      expect(typeof result.popularity).toBe('number');
    });
  });
});
