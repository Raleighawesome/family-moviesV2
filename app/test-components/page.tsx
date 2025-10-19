'use client';

import { useState } from 'react';
import { MovieCard } from '@/components/MovieCard';
import { ProviderChips } from '@/components/ProviderChips';
import { RatingStars } from '@/components/RatingStars';

export default function TestComponentsPage() {
  const [rating, setRating] = useState(3);

  // Sample movie data
  const sampleMovie = {
    id: 1,
    tmdb_id: 8587,
    title: 'The Lion King',
    year: 1994,
    poster_path: '/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg',
    rating: 'G',
    runtime: 88,
    genres: ['Animation', 'Family', 'Drama'],
  };

  const sampleMovie2 = {
    id: 2,
    tmdb_id: 550,
    title: 'Fight Club',
    year: 1999,
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    rating: 'R',
    runtime: 139,
    genres: ['Drama', 'Thriller', 'Action'],
  };

  const sampleMovie3 = {
    id: 3,
    tmdb_id: 12345,
    title: 'Movie Without Poster',
    year: 2020,
    poster_path: null,
    rating: 'PG-13',
    runtime: 120,
    genres: ['Action', 'Adventure'],
  };

  // Sample provider data
  const sampleProviders = {
    flatrate: [
      {
        provider_id: 8,
        provider_name: 'Netflix',
        logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
        display_priority: 1,
      },
      {
        provider_id: 337,
        provider_name: 'Disney Plus',
        logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg',
        display_priority: 2,
      },
    ],
    rent: [
      {
        provider_id: 2,
        provider_name: 'Apple TV',
        logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',
        display_priority: 3,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Component Test Page
        </h1>

        {/* MovieCard Tests */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            MovieCard Component
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card with all features */}
            <MovieCard
              movie={sampleMovie}
              actions={[
                {
                  label: 'Add to Queue',
                  onClick: () => alert('Added to queue!'),
                  variant: 'primary',
                },
                {
                  label: 'Mark Watched',
                  onClick: () => alert('Marked as watched!'),
                  variant: 'secondary',
                },
              ]}
            />

            {/* Card with different rating */}
            <MovieCard
              movie={sampleMovie2}
              actions={[
                {
                  label: 'Remove',
                  onClick: () => alert('Removed!'),
                  variant: 'danger',
                },
              ]}
            />

            {/* Card without poster */}
            <MovieCard
              movie={sampleMovie3}
              actions={[
                {
                  label: 'Disabled Action',
                  onClick: () => {},
                  disabled: true,
                },
              ]}
            />
          </div>
        </section>

        {/* ProviderChips Tests */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            ProviderChips Component
          </h2>
          <div className="space-y-4 bg-white p-6 rounded-lg shadow">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                With multiple providers:
              </h3>
              <ProviderChips providers={sampleProviders} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                With max 2 providers displayed:
              </h3>
              <ProviderChips providers={sampleProviders} maxDisplay={2} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                With no providers (null):
              </h3>
              <ProviderChips providers={null} />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                With empty providers:
              </h3>
              <ProviderChips providers={{}} />
            </div>
          </div>
        </section>

        {/* RatingStars Tests */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            RatingStars Component
          </h2>
          <div className="space-y-6 bg-white p-6 rounded-lg shadow">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Interactive (click to rate):
              </h3>
              <div className="flex items-center gap-4">
                <RatingStars rating={rating} onChange={setRating} />
                <span className="text-sm text-gray-600">
                  Current rating: {rating} stars
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Read-only (3 stars):
              </h3>
              <RatingStars rating={3} readonly />
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Different sizes:
              </h3>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Small</p>
                  <RatingStars rating={4} readonly size="sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Medium</p>
                  <RatingStars rating={4} readonly size="md" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Large</p>
                  <RatingStars rating={4} readonly size="lg" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                All ratings (read-only):
              </h3>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((r) => (
                  <div key={r} className="flex items-center gap-4">
                    <RatingStars rating={r} readonly />
                    <span className="text-sm text-gray-600">{r} star{r !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Navigation back */}
        <div className="mt-8">
          <a
            href="/chat"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ← Back to Chat
          </a>
        </div>
      </div>
    </div>
  );
}
