'use client';

import { useChat } from 'ai/react';
import { useState, useMemo } from 'react';
import { MovieResults } from '@/components/MovieResults';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await handleSubmit(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  // Extract movie data from tool invocations
  const extractMoviesFromMessage = (message: any) => {
    if (!message.toolInvocations) return [];

    const movies: any[] = [];
    const streamingData: Record<number, any> = {};
    const reasonsMap: Record<string, string> = {};

    // Parse reasons from the AI's text content
    // Looking for patterns like:
    // 1. "**Onward (2020)**" - A magical adventure with heartwarming themes.
    // 2. **Robin Hood (1973)** - A classic animated tale of heroism and adventure.
    if (message.content) {
      const reasonPattern = /\d+\.\s+\*\*(.+?)\s*\((\d{4})\)\*\*\s*-\s*(.+?)(?:\n|$)/g;
      let match;
      while ((match = reasonPattern.exec(message.content)) !== null) {
        const title = match[1].trim();
        const year = match[2];
        const reason = match[3].trim();
        const key = `${title}|${year}`;
        reasonsMap[key] = reason;
      }
    }

    // First pass: collect streaming data
    message.toolInvocations.forEach((tool: any) => {
      if (tool.toolName === 'get_streaming' && tool.state === 'result' && tool.result?.providers) {
        const tmdbId = tool.args?.tmdb_id;
        if (tmdbId) {
          streamingData[tmdbId] = tool.result.providers;
        }
      }
    });

    // Second pass: collect movies from search/recommend
    message.toolInvocations.forEach((tool: any) => {
      if (tool.state === 'result' && tool.result?.results) {
        tool.result.results.forEach((movie: any) => {
          const tmdbId = movie.tmdb_id;
          const movieKey = `${movie.title}|${movie.year}`;
          const reason = reasonsMap[movieKey] || null;

          movies.push({
            movie,
            providers: streamingData[tmdbId] || null,
            reason,
          });
        });
      }
    });

    return movies;
  };

  const handleAddToQueue = async (tmdbId: number) => {
    await append({
      role: 'user',
      content: `Add movie with TMDB ID ${tmdbId} to my queue`,
    });
  };

  const handleMarkWatched = async (tmdbId: number) => {
    await append({
      role: 'user',
      content: `Mark movie with TMDB ID ${tmdbId} as watched`,
    });
  };

  // Clean up message content by removing the numbered movie list
  // since we're displaying that info in the cards
  const cleanMessageContent = (content: string, hasMovies: boolean) => {
    if (!hasMovies) return content;

    // Remove numbered lists with movie details
    // Pattern: "1. **Movie (Year)** - reason\n  - details\n  - more details"
    const cleanedContent = content.replace(
      /\d+\.\s+\*\*[^*]+\*\*[^]*?(?=\d+\.\s+\*\*|\n\n|$)/g,
      ''
    );

    // Remove common list headers
    const finalContent = cleanedContent
      .replace(/Here are \d+ family-friendly movie recommendations[^:]*:/gi, '')
      .replace(/Here are three family-friendly movie recommendations[^:]*:/gi, '')
      .trim();

    return finalContent;
  };

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Family Movie Concierge</h1>
        <p className="text-sm text-gray-600 mt-1">
          Ask me to find movies, add to your queue, or get recommendations!
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Start a conversation
            </h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Try asking: &quot;Find family-friendly movies about space&quot; or
              &quot;Recommend something for movie night&quot;
            </p>
          </div>
        )}

        {messages.map((message) => {
          const movies = message.role === 'assistant' ? extractMoviesFromMessage(message) : [];

          return (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-full ${
                  message.role === 'user' ? 'max-w-3xl' : 'w-full'
                }`}
              >
                <div
                  className={`rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white inline-block'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.role === 'assistant'
                      ? cleanMessageContent(message.content, movies.length > 0)
                      : message.content}
                  </div>

                  {/* Display tool invocations if any */}
                  {message.toolInvocations && message.toolInvocations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      {message.toolInvocations.map((tool, idx) => (
                        <div key={idx} className="text-xs text-gray-600">
                          <span className="font-semibold">
                            {tool.toolName === 'tmdb_search' && '🔍 Searching movies...'}
                            {tool.toolName === 'add_to_queue' && '➕ Adding to queue...'}
                            {tool.toolName === 'recommend' && '✨ Getting recommendations...'}
                            {tool.toolName === 'mark_watched' && '✅ Recording watch...'}
                            {tool.toolName === 'get_streaming' && '📺 Getting streaming info...'}
                          </span>
                          {tool.state === 'result' && tool.result && (
                            <div className="mt-1 text-gray-500">
                              {typeof tool.result === 'object' && 'success' in tool.result
                                ? tool.result.success
                                  ? '✓ Done'
                                  : `✗ ${tool.result.error || 'Failed'}`
                                : '✓ Complete'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Render movie cards if movies were found */}
                {movies.length > 0 && (
                  <MovieResults
                    movies={movies}
                    onAddToQueue={handleAddToQueue}
                    onMarkWatched={handleMarkWatched}
                  />
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about movies..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
