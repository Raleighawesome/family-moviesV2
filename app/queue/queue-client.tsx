'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MovieCard } from '@/components/MovieCard';
import { RatingStars } from '@/components/RatingStars';

interface Movie {
  tmdb_id: number;
  title: string;
  year: number;
  poster_path: string | null;
  mpaa: string | null;
  runtime: number | null;
  genres: string[];
}

interface QueueItem {
  id: number;
  tmdb_id: number;
  created_at: string;
  movies: Movie;
}

interface QueueClientProps {
  queueItems: QueueItem[];
}

export function QueueClient({ queueItems }: QueueClientProps) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [showRatingModal, setShowRatingModal] = useState<{
    itemId: number;
    movie: Movie;
  } | null>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRemove = async (itemId: number) => {
    if (!confirm('Remove this movie from your queue?')) return;

    setRemovingId(itemId);
    try {
      const response = await fetch('/api/queue/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) throw new Error('Failed to remove');

      router.refresh();
    } catch (error) {
      alert('Failed to remove movie from queue');
      console.error(error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleMarkWatched = (itemId: number, movie: Movie) => {
    setShowRatingModal({ itemId, movie });
    setRating(0);
  };

  const submitMarkWatched = async () => {
    if (!showRatingModal) return;

    setIsSubmitting(true);
    try {
      // First, record the watch
      const response = await fetch('/api/watch/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: showRatingModal.itemId,
          tmdbId: showRatingModal.movie.tmdb_id,
          rating: rating > 0 ? rating : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to mark as watched');

      // Then remove from queue
      await fetch('/api/queue/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: showRatingModal.itemId }),
      });

      setShowRatingModal(null);
      router.refresh();
    } catch (error) {
      alert('Failed to mark movie as watched');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {queueItems.map((item) => {
          const movie = item.movies;
          if (!movie) return null;

          return (
            <MovieCard
              key={item.id}
              movie={{
                tmdb_id: movie.tmdb_id,
                title: movie.title,
                year: movie.year,
                poster_path: movie.poster_path,
                rating: movie.mpaa,
                runtime: movie.runtime,
                genres: movie.genres,
              }}
              actions={[
                {
                  label: 'Mark Watched',
                  onClick: () => handleMarkWatched(item.id, movie),
                  variant: 'primary',
                  disabled: removingId === item.id,
                },
                {
                  label: removingId === item.id ? 'Removing...' : 'Remove',
                  onClick: () => handleRemove(item.id),
                  variant: 'danger',
                  disabled: removingId === item.id,
                },
              ]}
            />
          );
        })}
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Mark as Watched
            </h2>
            <p className="text-gray-600 mb-6">
              {showRatingModal.movie.title} ({showRatingModal.movie.year})
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate this movie (optional):
              </label>
              <div className="flex justify-center">
                <RatingStars rating={rating} onChange={setRating} size="lg" maxStars={10} />
              </div>
              {rating > 0 && (
                <p className="text-center text-sm text-gray-600 mt-2">
                  {rating} star{rating !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRatingModal(null)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkWatched}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
