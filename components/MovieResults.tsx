'use client';

import { MovieCard } from './MovieCard';
import { useEffect, useMemo, useState } from 'react';

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
export function MovieResults({ movies }: MovieResultsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<number, 'queue' | 'watched' | null>>({});
  const [inQueueInitial, setInQueueInitial] = useState<Record<number, boolean>>({});
  const [sessionQueueIds, setSessionQueueIds] = useState<Record<number, number | null>>({});
  const [sessionWatchIds, setSessionWatchIds] = useState<Record<number, number | null>>({});

  const tmdbIds = useMemo(() => Array.from(new Set(movies.map(m => m.movie.tmdb_id))), [movies]);

  // Fetch initial queue state for these movies
  useEffect(() => {
    let cancelled = false;
    async function loadState() {
      try {
        if (tmdbIds.length === 0) return;
        const res = await fetch('/api/queue/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbIds }),
        });
        const data = await res.json();
        if (!cancelled && data?.ok) {
          const map: Record<number, boolean> = {};
          (data.inQueue as number[]).forEach((id: number) => (map[id] = true));
          setInQueueInitial(map);
        }
      } catch {}
    }
    loadState();
    return () => { cancelled = true; };
  }, [tmdbIds.join(',')]);

  const handleAddToQueue = async (tmdbId: number, movieData?: any) => {
    const sessionId = sessionQueueIds[tmdbId];
    const initiallyQueued = inQueueInitial[tmdbId];
    setLoadingStates(prev => ({ ...prev, [tmdbId]: 'queue' }));
    try {
      if (sessionId) {
        // Remove only the item created this session
        await fetch('/api/queue/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: sessionId }),
        });
        setSessionQueueIds(prev => ({ ...prev, [tmdbId]: null }));
      } else if (!initiallyQueued) {
        // Add to queue
        const res = await fetch('/api/queue/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId, movie: movieData }),
        });
        const data = await res.json();
        if (data?.ok) {
          if (data.queueItemId) {
            setSessionQueueIds(prev => ({ ...prev, [tmdbId]: data.queueItemId }));
          } else {
            // If server didn't return id, at least reflect Added state
            setInQueueInitial(prev => ({ ...prev, [tmdbId]: true }));
          }
        }
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [tmdbId]: null }));
    }
  };

  const handleMarkWatched = async (tmdbId: number) => {
    const watchId = sessionWatchIds[tmdbId];
    setLoadingStates(prev => ({ ...prev, [tmdbId]: 'watched' }));
    try {
      if (watchId) {
        // Delete just the watch we created in this session
        const url = new URL('/api/watch/remove', window.location.origin);
        url.searchParams.set('watchId', String(watchId));
        await fetch(url.toString(), { method: 'DELETE' });
        setSessionWatchIds(prev => ({ ...prev, [tmdbId]: null }));
      } else {
        // Mark as watched without rating
        const res = await fetch('/api/watch/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tmdbId }),
        });
        const data = await res.json();
        if (data?.ok) {
          setSessionWatchIds(prev => ({ ...prev, [tmdbId]: data.watchId || null }));
        }
      }
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
          id: (movie as any).id || movie.tmdb_id,
          // Ensure rating badge shows by mapping mpaa -> rating when needed
          rating: (movie as any).rating ?? (movie as any).mpaa ?? null,
        } as any;
        const loading = loadingStates[movie.tmdb_id];

        const isInQueueBySession = !!sessionQueueIds[movie.tmdb_id];
        const initiallyQueued = !!inQueueInitial[movie.tmdb_id];
        const isInQueue = isInQueueBySession || initiallyQueued;
        const canToggleQueue = isInQueueBySession || !initiallyQueued; // don't remove pre-existing items

        return (
          <MovieCard
            key={movie.tmdb_id}
            movie={movieWithId}
            providers={result.providers}
            reason={result.reason || undefined}
            actions={[
              {
                label: loading === 'queue' ? (isInQueue ? 'Removing...' : 'Adding...') : (isInQueue ? 'Added' : 'Add to Queue'),
                onClick: () => handleAddToQueue(movie.tmdb_id, movieWithId),
                variant: 'primary',
                disabled: !!loading || !canToggleQueue,
              },
              {
                label: loading === 'watched' ? 'Updating...' : (sessionWatchIds[movie.tmdb_id] ? 'Watched' : 'Mark Watched'),
                onClick: () => handleMarkWatched(movie.tmdb_id),
                variant: 'secondary',
                disabled: !!loading,
              },
            ]}
          />
        );
      })}
    </div>
  );
}
