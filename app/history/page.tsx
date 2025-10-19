import { createClient } from '@/lib/supabase/server';
import { RatingStars } from '@/components/RatingStars';
import { RemoveWatchButton } from '@/components/RemoveWatchButton';
import Image from 'next/image';

export default async function HistoryPage() {
  const supabase = await createClient();

  // Get current user and household
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Not authenticated</div>;
  }

  const { data: householdMember } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!householdMember) {
    return <div>No household found</div>;
  }

  // Fetch watch history with notes
  const { data: watches, error: watchesError } = await supabase
    .from('watches')
    .select(
      `
      id,
      watched_at,
      rewatch,
      notes,
      tmdb_id,
      profile_id,
      movies (
        tmdb_id,
        title,
        year,
        poster_path,
        mpaa,
        runtime,
        genres
      ),
      profiles (
        display_name
      )
    `
    )
    .eq('household_id', householdMember.household_id)
    .order('watched_at', { ascending: false })
    .limit(100);

  if (watchesError) {
    console.error('[History] Error fetching watches:', watchesError);
  }

  // Group watches by movie and fetch ratings
  const movieWatchMap = new Map<number, any[]>();
  (watches || []).forEach((watch) => {
    const tmdbId = watch.tmdb_id;
    if (!movieWatchMap.has(tmdbId)) {
      movieWatchMap.set(tmdbId, []);
    }
    movieWatchMap.get(tmdbId)!.push(watch);
  });

  // Fetch ratings for each movie
  const moviesWithData = await Promise.all(
    Array.from(movieWatchMap.entries()).map(async ([tmdbId, watches]) => {
      const firstWatch = watches[0];

      // Get rating for this movie
      let ratingQuery = supabase
        .from('ratings')
        .select('rating')
        .eq('household_id', householdMember.household_id)
        .eq('tmdb_id', tmdbId);

      if (firstWatch.profile_id) {
        ratingQuery = ratingQuery.eq('profile_id', firstWatch.profile_id);
      } else {
        ratingQuery = ratingQuery.is('profile_id', null);
      }

      const { data: rating } = await ratingQuery.maybeSingle();

      return {
        movie: firstWatch.movies,
        watches: watches.sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime()),
        rating: rating?.rating || null,
        watchCount: watches.length,
      };
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Watch History</h1>
          <p className="text-gray-600 mt-2">
            Movies your family has watched together
          </p>
        </div>

        {!moviesWithData || moviesWithData.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No watch history yet
            </h3>
            <p className="mt-2 text-gray-500">
              Mark movies as watched in the chat or queue to see them here!
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {moviesWithData.map((item: any) => {
              const movie = item.movie;
              const rating = item.rating;
              const watches = item.watches;

              if (!movie) return null;

              const posterUrl = movie.poster_path
                ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
                : '/placeholder-poster.png';

              return (
                <div key={movie.tmdb_id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex gap-4">
                    {/* Poster */}
                    <div className="flex-shrink-0">
                      <div className="relative w-24 h-36">
                        <Image
                          src={posterUrl}
                          alt={`${movie.title} poster`}
                          fill
                          className="object-cover rounded"
                          sizes="96px"
                        />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {movie.title}
                          </h3>

                          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                            {movie.year && <span>{movie.year}</span>}
                            {movie.mpaa && (
                              <>
                                <span>•</span>
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                                  {movie.mpaa}
                                </span>
                              </>
                            )}
                            {movie.runtime && (
                              <>
                                <span>•</span>
                                <span>{movie.runtime} min</span>
                              </>
                            )}
                          </div>

                          {movie.genres && movie.genres.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {movie.genres.slice(0, 4).map((genre: string) => (
                                <span
                                  key={genre}
                                  className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded"
                                >
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Rating */}
                        {rating && (
                          <div className="flex-shrink-0">
                            <RatingStars rating={rating} readonly size="sm" maxStars={10} />
                            <p className="text-xs text-gray-500 mt-1 text-center">
                              {rating}/10
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Watch entries */}
                      <div className="mt-4 space-y-3">
                        {watches.map((watch: any, idx: number) => (
                          <div key={watch.id} className="border-l-2 border-blue-500 pl-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-medium">
                                  {idx === 0 ? 'Most recent:' : `Watch #${watches.length - idx}:`}
                                </span>
                                <span>
                                  {new Date(watch.watched_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                                {watch.profiles?.display_name && (
                                  <>
                                    <span>•</span>
                                    <span>by {watch.profiles.display_name}</span>
                                  </>
                                )}
                              </div>
                              <RemoveWatchButton
                                watchId={watch.id}
                                tmdbId={movie.tmdb_id}
                                movieTitle={movie.title}
                                watchDate={new Date(watch.watched_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                isOnlyWatch={watches.length === 1}
                              />
                            </div>
                            {watch.notes && (
                              <p className="mt-1 text-sm text-gray-700 italic">
                                &quot;{watch.notes}&quot;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Watch count badge */}
                      {item.watchCount > 1 && (
                        <div className="mt-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Watched {item.watchCount} time{item.watchCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
