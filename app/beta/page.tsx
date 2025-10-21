"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function BetaAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading…</div>}>
      <BetaAccessContent />
    </Suspense>
  );
}

function BetaAccessContent() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useSearchParams();

  const next = params.get('next') || '/login';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/beta-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid credentials');
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Family Movies</h1>
          <p className="mt-2 text-sm text-gray-600">Beta Access</p>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-100 p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none"
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Enter'}
            </button>
          </form>

          {/* Intentionally no hint text during beta */}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          By continuing you agree to the beta terms.
        </div>
      </div>
    </div>
  );
}
