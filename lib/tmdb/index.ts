// TMDB API Integration Module

export * from './types';
export * from './client';
export * from './normalize';

// Re-export commonly used functions for convenience
export {
  searchMovies,
  getMovieDetails,
  getMovieReleaseDates,
  getMovieKeywords,
  getMovieWatchProviders,
  getMovieCredits,
  getCompleteMovieData,
  extractMPAARating,
  getTMDBImageUrl,
} from './client';

export {
  normalizeTMDBMovie,
  normalizeTMDBProviders,
  getFullPosterUrl,
  getFullBackdropUrl,
  extractDirectors,
  extractMainCast,
  formatRuntime,
  isFamilyFriendly,
  hasBlockedKeywords,
} from './normalize';
