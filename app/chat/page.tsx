'use client';

import { useChat } from 'ai/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { MovieResults } from '@/components/MovieResults';

type ToolInvocation = {
  toolCallId?: string;
  toolName: string;
  args?: Record<string, any> | null;
  state?: 'call' | 'result';
  result?: any;
};

type ChatMessage = {
  id?: string;
  role: string;
  content: string;
  toolInvocations?: ToolInvocation[];
  created_at?: string;
};

type ChatSessionSummary = {
  id: string;
  title: string | null;
  started_at: string;
  last_activity_at: string;
  message_count: number;
};

function aggregateTurnMovies(messagesList: ChatMessage[], currentIndex: number) {
  let start = 0;
  for (let i = currentIndex; i >= 0; i--) {
    if (messagesList[i]?.role === 'user') {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }

  let end = messagesList.length - 1;
  for (let j = currentIndex + 1; j < messagesList.length; j++) {
    if (messagesList[j]?.role === 'user') {
      end = j - 1;
      break;
    }
  }

  const reasonsMap: Record<string, string> = {};
  const streamingData: Record<number, any> = {};
  const collectedMovies: Record<number, any> = {};

  for (let k = start; k <= end; k++) {
    const m: any = messagesList[k];
    if (!m || m.role !== 'assistant') continue;

    if (m.content) {
      const reasonPattern = /\d+\.\s+\*\*(.+?)\s*\((\d{4})\)\*\*\s*-\s*(.+?)(?:\n|$)/g;
      let match;
      while ((match = reasonPattern.exec(m.content)) !== null) {
        const title = match[1].trim();
        const year = match[2];
        const reason = match[3].trim();
        reasonsMap[`${title}|${year}`] = reason;
      }
    }

    if (!m.toolInvocations) continue;

    m.toolInvocations.forEach((tool: any) => {
      if (tool.toolName === 'get_streaming' && tool.state === 'result' && tool.result?.providers) {
        const tmdbId = tool.args?.tmdb_id ?? tool.args?.tmdbId ?? tool.args?.id;
        if (tmdbId) streamingData[tmdbId] = tool.result.providers;
      }
    });

    m.toolInvocations.forEach((tool: any) => {
      if (tool.state === 'result' && tool.result?.results) {
        tool.result.results.forEach((movie: any) => {
          collectedMovies[movie.tmdb_id] = movie;
        });
      }
    });
  }

  const movies = Object.values(collectedMovies).map((movie: any) => {
    const movieKey = `${movie.title}|${movie.year}`;
    const reason = movie.reason || reasonsMap[movieKey] || null;
    const pv = (movie as any).providers;
    const sd = streamingData[movie.tmdb_id];
    const providers = pv || sd || null;
    return {
      movie,
      providers,
      reason,
    };
  });

  let lastAssistantIndex = -1;
  for (let x = end; x >= start; x--) {
    if (messagesList[x]?.role === 'assistant') {
      lastAssistantIndex = x;
      break;
    }
  }

  return { movies, isLastAssistantInTurn: currentIndex === lastAssistantIndex };
}

function cleanMessageContent(content: string, hasMovies: boolean) {
  if (!hasMovies) return content;

  const cleanedContent = content.replace(
    /\d+\.\s+\*\*[^*]+\*\*[^]*?(?=\d+\.\s+\*\*|\n\n|$)/g,
    ''
  );

  const finalContent = cleanedContent
    .replace(/Here are \d+ family-friendly movie recommendations[^:]*:/gi, '')
    .replace(/Here are three family-friendly movie recommendations[^:]*:/gi, '')
    .trim();

  return finalContent;
}

function formatSessionTitle(session: ChatSessionSummary) {
  if (session.title) return session.title;
  try {
    return `Started ${new Date(session.started_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`;
  } catch {
    return 'Conversation';
  }
}

function formatTimestamp(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ChatPage() {
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pendingSession = useRef<Promise<string> | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSessionSummary[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionSummary | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [deleteHistoryError, setDeleteHistoryError] = useState<string | null>(null);
  const historyCache = useRef(new Map<string, ChatMessage[]>());

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/history');
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load chat history');
      }
      setHistorySessions(payload?.sessions ?? []);
      setHistoryError(null);
    } catch (err) {
      console.error('[Chat] Failed to load history sessions', err);
      setHistoryError(err instanceof Error ? err.message : 'Failed to load chat history');
    }
  }, []);

  const fetchHistoryMessages = useCallback(async (id: string) => {
    if (!id) return;
    if (historyCache.current.has(id)) {
      setHistoryMessages(historyCache.current.get(id)!);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/chat/history/${id}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load chat session');
      }
      const mapped: ChatMessage[] = (payload?.messages ?? []).map((message: any, index: number) => ({
        id: String(message.id ?? `${message.created_at || 'msg'}-${index}`),
        role: message.role,
        content: message.content ?? '',
        toolInvocations: message.toolInvocations ?? undefined,
        created_at: message.created_at,
      }));
      historyCache.current.set(id, mapped);
      setHistoryMessages(mapped);
      setHistoryError(null);
    } catch (err) {
      console.error('[Chat] Failed to load chat session messages', err);
      setHistoryError(err instanceof Error ? err.message : 'Failed to load chat session');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const createNewSession = useCallback(async () => {
    if (pendingSession.current) {
      return pendingSession.current;
    }
    const promise = (async () => {
      setIsCreatingSession(true);
      try {
        const res = await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.sessionId) {
          throw new Error(payload?.error || 'Failed to create chat session');
        }
        setSessionId(payload.sessionId);
        return payload.sessionId as string;
      } finally {
        setIsCreatingSession(false);
        pendingSession.current = null;
      }
    })();

    pendingSession.current = promise;
    return promise;
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    return await createNewSession();
  }, [sessionId, createNewSession]);

  useEffect(() => {
    if (isHistoryOpen) {
      fetchSessions();
    }
  }, [isHistoryOpen, fetchSessions]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    if (historySessions.length === 0) {
      if (selectedHistorySession) {
        setSelectedHistorySession(null);
      }
      setHistoryMessages([]);
      return;
    }

    const hasSelectedSession =
      !!selectedHistorySession && historySessions.some((session) => session.id === selectedHistorySession);

    if (!hasSelectedSession) {
      const firstId = historySessions[0].id;
      setSelectedHistorySession(firstId);
      fetchHistoryMessages(firstId);
    }
  }, [isHistoryOpen, historySessions, selectedHistorySession, fetchHistoryMessages]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    setInput,
  } = useChat({
    body: { sessionId },
    onFinish: async () => {
      if (sessionId) {
        historyCache.current.delete(sessionId);
        if (isHistoryOpen && selectedHistorySession === sessionId) {
          await fetchHistoryMessages(sessionId);
        }
      }
      if (isHistoryOpen) {
        await fetchSessions();
      }
    },
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (typeof (e as any).persist === 'function') {
      (e as any).persist();
    }
    if (!input.trim()) return;
    setError(null);
    try {
      const ensuredSessionId = await ensureSession();
      if (!ensuredSessionId) {
        throw new Error('Failed to create chat session');
      }
      await handleSubmit(e, { body: { sessionId: ensuredSessionId } });
    } catch (err) {
      console.error('[Chat] Failed to send message', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const startNewChat = useCallback(() => {
    setError(null);
    setMessages([]);
    setInput('');
    historyCache.current.clear();
    pendingSession.current = null;
    setSessionId(null);
  }, [setMessages, setInput]);

  const renderMessageList = (messageList: ChatMessage[], options?: { keyPrefix?: string; showTimestamp?: boolean }) => {
    return messageList.map((message, idx) => {
      const { movies, isLastAssistantInTurn } =
        message.role === 'assistant'
          ? aggregateTurnMovies(messageList, idx)
          : { movies: [], isLastAssistantInTurn: false };
      const isMarkWatchedFlow = !!message.toolInvocations?.some((t) => t.toolName === 'mark_watched');
      const suppressAssistantBubble = message.role === 'assistant' && movies.length > 0;
      const key = `${options?.keyPrefix || 'msg'}-${message.id || idx}`;

      return (
        <div
          key={key}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-full ${message.role === 'user' ? 'max-w-3xl' : 'w-full'}`}
          >
            {!suppressAssistantBubble && (
              <div
                className={`rounded-lg px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white inline-block'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">
                  {(() => {
                    if (message.role !== 'assistant') return message.content;

                    const mw = message.toolInvocations?.find(
                      (t: any) =>
                        t.toolName === 'mark_watched' &&
                        t.state === 'result' &&
                        t.result?.message
                    );
                    if (mw) return mw.result.message;

                    return cleanMessageContent(message.content, movies.length > 0);
                  })()}
                </div>

                {message.toolInvocations && message.toolInvocations.length > 0 && !isMarkWatchedFlow && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    {message.toolInvocations.map((tool: any, toolIdx: number) => (
                      <div key={toolIdx} className="text-xs text-gray-600">
                        <span className="font-semibold">
                          {tool.toolName === 'tmdb_search' && '🔍 Searching movies...'}
                          {tool.toolName === 'add_to_queue' && '➕ Adding to queue...'}
                          {tool.toolName === 'recommend' && '✨ Getting recommendations...'}
                          {tool.toolName === 'mark_watched' && '✅ Recording watch...'}
                          {tool.toolName === 'get_streaming' && '📺 Getting streaming info...'}
                          {tool.toolName === 'update_rating' && '⭐ Updating rating...'}
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
            )}

            {options?.showTimestamp && message.created_at && (
              <div
                className={`mt-1 text-xs text-gray-400 ${
                  message.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                {formatTimestamp(message.created_at)}
              </div>
            )}

            {message.role === 'assistant' && movies.length > 0 && isLastAssistantInTurn && (
              <MovieResults movies={movies} />
            )}
          </div>
        </div>
      );
    });
  };

  const openHistoryForSession = useCallback(
    async (id: string) => {
      setSelectedHistorySession(id);
      await fetchHistoryMessages(id);
    },
    [fetchHistoryMessages]
  );

  const confirmDeleteSession = useCallback(async () => {
    const target = deleteTarget;
    if (!target) return;

    setIsDeletingHistory(true);
    setDeleteHistoryError(null);

    try {
      const res = await fetch(`/api/chat/history/${target.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to delete chat session');
      }

      historyCache.current.delete(target.id);

      if (selectedHistorySession === target.id) {
        setSelectedHistorySession(null);
        setHistoryMessages([]);
      }

      setHistorySessions((prev) => prev.filter((session) => session.id !== target.id));

      if (sessionId === target.id) {
        setSessionId(null);
        setMessages([]);
        setInput('');
        pendingSession.current = null;
      }

      setDeleteTarget(null);
      await fetchSessions();
    } catch (err) {
      console.error('[Chat] Failed to delete chat history session', err);
      setDeleteHistoryError(err instanceof Error ? err.message : 'Failed to delete chat session');
    } finally {
      setIsDeletingHistory(false);
    }
  }, [deleteTarget, fetchSessions, selectedHistorySession, sessionId, setMessages, setInput]);

  const sendDisabled = isLoading || isCreatingSession || !input.trim();

  return (
    <>
      <div className="flex bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex flex-col flex-1">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Family Movie Concierge</h1>
              <p className="text-sm text-gray-600 mt-1">
                Ask me to find movies, add to your queue, or get recommendations!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startNewChat}
                disabled={isLoading || isCreatingSession}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingSession ? 'Starting…' : 'New chat'}
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800"
              >
                Chat history
              </button>
            </div>
          </div>
        </div>

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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start a conversation</h3>
              <p className="text-gray-500 text-sm max-w-sm mx-auto">
                Try asking: &quot;Find family-friendly movies about space&quot; or &quot;Recommend something for movie night&quot;
              </p>
            </div>
          )}

          {renderMessageList(messages as ChatMessage[])}

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

        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <SuggestionChips />
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
              disabled={isLoading || isCreatingSession}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={sendDisabled}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {isHistoryOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setIsHistoryOpen(false)}
          />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col border-l border-gray-200 lg:static lg:w-96 lg:shadow-none lg:h-full">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Chat history</h2>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-3 border-b border-gray-200">
              {historySessions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Conversations will appear here after you finish a chat.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {historySessions.map((session) => {
                    const isActive = selectedHistorySession === session.id;
                    return (
                      <div key={session.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => openHistoryForSession(session.id)}
                          className={`w-full text-left px-3 py-2 pr-12 rounded-lg border transition ${
                            isActive
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-sm font-medium truncate">
                            {formatSessionTitle(session)}
                          </div>
                          <div className="mt-1 flex justify-between text-xs text-gray-500">
                            <span>{formatTimestamp(session.last_activity_at)}</span>
                            <span>
                              {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label="Delete conversation"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteHistoryError(null);
                            setDeleteTarget(session);
                          }}
                          className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 ${
                            isActive
                              ? 'opacity-100'
                              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.5 3a1.5 1.5 0 0 1 3 0H15a.75.75 0 0 1 0 1.5h-.388l-.73 10.22A2.25 2.25 0 0 1 11.64 17H8.36a2.25 2.25 0 0 1-2.242-2.28L5.388 4.5H5A.75.75 0 0 1 5 3h3.5Zm-1.853 1.5.706 9.876a.75.75 0 0 0 .75.624h3.28a.75.75 0 0 0 .75-.624L12.353 4.5H6.647Zm1.647 2.25a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm3 0a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {historyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {historyError}
                </div>
              )}
              {historyLoading && (
                <div className="text-sm text-gray-500">Loading conversation…</div>
              )}
              {!historyLoading && !historyError && historyMessages.length === 0 && (
                <div className="text-sm text-gray-500">
                  Select a conversation to review its messages.
                </div>
              )}
              {!historyLoading && historyMessages.length > 0 && (
                <div className="space-y-4">
                  {renderMessageList(historyMessages, { keyPrefix: 'history', showTimestamp: true })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
        </div>
        {deleteTarget && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
            onClick={() => {
              if (isDeletingHistory) return;
              setDeleteTarget(null);
              setDeleteHistoryError(null);
            }}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900">Delete conversation?</h3>
              <p className="mt-2 text-sm text-gray-600">
                This will permanently remove{' '}
                {deleteTarget.title ? `“${deleteTarget.title}”` : 'this conversation'} from your chat history.
              </p>
              {deleteHistoryError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteHistoryError}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isDeletingHistory) return;
                    setDeleteTarget(null);
                    setDeleteHistoryError(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isDeletingHistory}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSession}
                  disabled={isDeletingHistory}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingHistory ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

function SuggestionChips() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const inputEl = () =>
    document.querySelector('input[placeholder="Ask about movies..."]') as HTMLInputElement | null;

  const addText = (text: string) => {
    const el = inputEl();
    if (!el) return;
    const current = el.value || '';
    const spacer = current && !current.endsWith(' ') ? ' ' : '';
    if (!current.toLowerCase().includes(text.toLowerCase())) {
      el.value = current + spacer + text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
    }
  };

  const chip = (label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 text-xs rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 mr-2 mb-2"
    >
      {label}
    </button>
  );

  return (
    <div className="mb-3 -mt-1 flex flex-wrap">
      {chip('1990s', () => addText('from the 1990s'))}
      {chip('1980s', () => addText('from the 1980s'))}
      {chip('2000s', () => addText('from the 2000s'))}
      {chip('Adventure', () => addText('adventure'))}
      {chip('Animation', () => addText('animation'))}
      {chip('Comedy', () => addText('comedy'))}
      {chip('Highly rated (7.5+)', () => addText('highly rated'))}
      {chip('Streaming only', () => addText('streaming only'))}
      {chip('Pixar', () => addText('Pixar'))}
    </div>
  );
}
