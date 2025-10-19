'use client';

import { MovieCard } from './MovieCard';
import { useState } from 'react';

interface Movie {
  id?: number;
  tmdb_id: number;
  title: string;
  year: number;
  poster_path: string | null;
  rating: string | null;
  runtime: number | null;
  genres: string[];
}

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

interface MovieResult {
  movie: Movie;
  providers?: {
    flatrate?: Provider[];
    rent?: Provider[];
    buy?: Provider[];
  } | null;
  reason?: string | null; // Why this movie was recommended
}

interface MovieResultsProps {
  movies: MovieResult[];
  onAddToQueue?: (tmdbId: number) => Promise<void>;
  onMarkWatched?: (tmdbId: number) => Promise<void>;
}

/**
 * MovieResults - Grid display of movie cards with actions
 *
 * Renders a grid of movie cards from AI responses with add to queue
 * and mark watched buttons.
 */
export function MovieResults({ movies, onAddToQueue, onMarkWatched }: MovieResultsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<number, 'queue' | 'watched' | null>>({});

  const handleAddToQueue = async (tmdbId: number) => {
    if (!onAddToQueue) return;
    setLoadingStates(prev => ({ ...prev, [tmdbId]: 'queue' }));
    try {
      await onAddToQueue(tmdbId);
    } finally {
      setLoadingStates(prev => ({ ...prev, [tmdbId]: null }));
    }
  };

  const handleMarkWatched = async (tmdbId: number) => {
    if (!onMarkWatched) return;
    setLoadingStates(prev => ({ ...prev, [tmdbId]: 'watched' }));
    try {
      await onMarkWatched(tmdbId);
    } finally {
      setLoadingStates(prev => ({ ...prev, [tmdbId]: null }));
    }
  };

  if (movies.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      {movies.map((result) => {
        const movie = result.movie;
        const movieWithId = {
          ...movie,
          id: movie.id || movie.tmdb_id,
        };
        const loading = loadingStates[movie.tmdb_id];

        return (
          <MovieCard
            key={movie.tmdb_id}
            movie={movieWithId}
            providers={result.providers}
            reason={result.reason || undefined}
            actions={[
              {
                label: loading === 'queue' ? 'Adding...' : 'Add to Queue',
                onClick: () => handleAddToQueue(movie.tmdb_id),
                variant: 'primary',
                disabled: loading !== null,
              },
              {
                label: loading === 'watched' ? 'Marking...' : 'Mark Watched',
                onClick: () => handleMarkWatched(movie.tmdb_id),
                variant: 'secondary',
                disabled: loading !== null,
              },
            ]}
          />
        );
      })}
    </div>
  );
}
