import Image from 'next/image';
import { ProviderChips } from './ProviderChips';

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  year: number;
  poster_path: string | null;
  rating: string | null;
  runtime: number | null;
  genres: string[];
}

interface MovieCardAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

interface MovieCardProps {
  movie: Movie;
  actions?: MovieCardAction[];
  providers?: {
    flatrate?: Provider[];
    rent?: Provider[];
    buy?: Provider[];
  } | null;
  reason?: string; // Why this movie was recommended
}

/**
 * MovieCard - Reusable movie display component
 *
 * Displays movie poster, title, year, rating, runtime, and genres
 * with optional action buttons and streaming providers.
 */
export function MovieCard({ movie, actions = [], providers, reason }: MovieCardProps) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` // Changed from w342 to w185 (approx 50% smaller)
    : '/placeholder-poster.png';

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getRatingColor = (rating: string | null) => {
    switch (rating) {
      case 'G':
        return 'bg-green-100 text-green-800';
      case 'PG':
        return 'bg-blue-100 text-blue-800';
      case 'PG-13':
        return 'bg-yellow-100 text-yellow-800';
      case 'R':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getButtonStyles = (variant: MovieCardAction['variant'] = 'secondary') => {
    const base = 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    switch (variant) {
      case 'primary':
        return `${base} bg-blue-600 text-white hover:bg-blue-700`;
      case 'danger':
        return `${base} bg-red-600 text-white hover:bg-red-700`;
      default:
        return `${base} bg-gray-200 text-gray-900 hover:bg-gray-300`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
      {/* Reason for recommendation (if provided) */}
      {reason && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
          <p className="text-sm text-blue-900 italic">{reason}</p>
        </div>
      )}

      <div className="flex gap-4 p-4">
        {/* Poster - Now 50% smaller */}
        <div className="relative flex-shrink-0" style={{ width: '92px', height: '138px' }}>
          <Image
            src={posterUrl}
            alt={`${movie.title} (${movie.year}) poster`}
            fill
            className="object-cover rounded"
            sizes="92px"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Title & Year */}
          <h3 className="font-semibold text-base text-gray-900 mb-1 line-clamp-2">
            {movie.title}
          </h3>
          <p className="text-sm text-gray-600 mb-2">{movie.year}</p>

          {/* Metadata - Rating & Runtime */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* MPAA Rating Badge */}
            {movie.rating && (
              <span
                className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${getRatingColor(
                  movie.rating
                )}`}
              >
                {movie.rating}
              </span>
            )}

            {/* Runtime */}
            {movie.runtime && (
              <span className="text-sm text-gray-600">{formatRuntime(movie.runtime)}</span>
            )}
          </div>

          {/* Genres */}
          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {movie.genres.slice(0, 3).map((genre, index) => (
                <span
                  key={index}
                  className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Streaming Providers */}
          {providers && (
            <div className="mb-3 mt-auto">
              <ProviderChips providers={providers} />
            </div>
          )}

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-auto">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={getButtonStyles(action.variant)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
