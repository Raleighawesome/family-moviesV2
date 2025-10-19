import { createClient } from '@/lib/supabase/server';
import { QueueClient } from './queue-client';

export default async function QueuePage() {
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

  // Fetch queue items with movie data
  const { data: queueItems } = await supabase
    .from('list_items')
    .select(
      `
      id,
      tmdb_id,
      created_at,
      movies (
        id,
        tmdb_id,
        title,
        year,
        poster_path,
        mpaa,
        runtime,
        genres
      )
    `
    )
    .eq('household_id', householdMember.household_id)
    .eq('list_type', 'queue')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Queue</h1>
          <p className="text-gray-600 mt-2">
            Movies you want to watch together as a family
          </p>
        </div>

        {!queueItems || queueItems.length === 0 ? (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Your queue is empty
            </h3>
            <p className="mt-2 text-gray-500">
              Start by asking the AI to find movies in the chat!
            </p>
            <div className="mt-6">
              <a
                href="/chat"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Go to Chat
              </a>
            </div>
          </div>
        ) : (
          <QueueClient queueItems={queueItems} />
        )}
      </div>
    </div>
  );
}
