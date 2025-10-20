'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const RATING_OPTIONS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [householdName, setHouseholdName] = useState('');
  const [allowedRatings, setAllowedRatings] = useState<string[]>(['G', 'PG', 'PG-13']);
  const [maxRuntime, setMaxRuntime] = useState(140);
  const [blockedKeywords, setBlockedKeywords] = useState('');
  const [preferredStreamingServices, setPreferredStreamingServices] = useState<string[]>([]);
  const [availableStreamingServices, setAvailableStreamingServices] = useState<
    Array<{ name: string; logo_path: string | null }>
  >([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [rewatchExclusionDays, setRewatchExclusionDays] = useState(365);

  const supabase = createClient();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage({ type: 'error', text: 'Not authenticated' });
        return;
      }

      const { data: householdMember } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!householdMember) {
        setMessage({ type: 'error', text: 'No household found' });
        return;
      }

      // Load household info
      const { data: household } = await supabase
        .from('households')
        .select('name')
        .eq('id', householdMember.household_id)
        .single();

      if (household) {
        setHouseholdName(household.name);
      }

      // Load family preferences
      const { data: prefs } = await supabase
        .from('family_prefs')
        .select('*')
        .eq('household_id', householdMember.household_id)
        .single();

      if (prefs) {
        setAllowedRatings(prefs.allowed_ratings || ['G', 'PG', 'PG-13']);
        setMaxRuntime(prefs.max_runtime || 140);
        setBlockedKeywords(prefs.blocked_keywords?.join(', ') || '');
        setPreferredStreamingServices(prefs.preferred_streaming_services || []);
        setRewatchExclusionDays(prefs.rewatch_exclusion_days ?? 365);
      }

      // Load available streaming services
      await loadStreamingServices();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadStreamingServices() {
    setLoadingServices(true);
    try {
      const response = await fetch('/api/streaming-services');
      if (response.ok) {
        const data = await response.json();
        setAvailableStreamingServices(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to load streaming services:', error);
    } finally {
      setLoadingServices(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('Not authenticated');

      const { data: householdMember } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single();

      if (!householdMember) throw new Error('No household found');

      // Update family preferences
      const keywords = blockedKeywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const { error } = await supabase
        .from('family_prefs')
        .upsert(
          {
            household_id: householdMember.household_id,
            allowed_ratings: allowedRatings,
            max_runtime: maxRuntime,
            blocked_keywords: keywords,
            preferred_streaming_services: preferredStreamingServices,
            rewatch_exclusion_days: rewatchExclusionDays,
          },
          {
            onConflict: 'household_id',
          }
        );

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Save settings error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      setMessage({
        type: 'error',
        text: `Failed to save settings: ${errorMessage}`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Family Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your household&apos;s movie preferences and content filters
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {/* Household Name */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Household</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Household Name
              </label>
              <input
                type="text"
                value={householdName}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Contact support to change your household name
              </p>
            </div>
          </div>

          {/* Allowed Ratings */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Allowed Ratings
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Only movies with these ratings will appear in search results and
              recommendations
            </p>
            <div className="space-y-2">
              {RATING_OPTIONS.map((rating) => (
                <label
                  key={rating}
                  className="flex items-center space-x-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={allowedRatings.includes(rating)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAllowedRatings([...allowedRatings, rating]);
                      } else {
                        setAllowedRatings(allowedRatings.filter((r) => r !== rating));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900 font-medium">{rating}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Max Runtime */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Maximum Runtime
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Movies longer than this won&apos;t appear in results (current: {maxRuntime}{' '}
              minutes)
            </p>
            <input
              type="range"
              min="60"
              max="240"
              step="10"
              value={maxRuntime}
              onChange={(e) => setMaxRuntime(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>60 min</span>
              <span>240 min</span>
            </div>
          </div>

          {/* Re-watch Exclusion Period */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Re-watch Recommendations
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Don&apos;t recommend movies watched within the last{' '}
              {rewatchExclusionDays === 0
                ? 'Never (always allow rewatches)'
                : rewatchExclusionDays === 1
                ? '1 day'
                : rewatchExclusionDays === 30
                ? '1 month'
                : rewatchExclusionDays === 90
                ? '3 months'
                : rewatchExclusionDays === 180
                ? '6 months'
                : rewatchExclusionDays === 365
                ? '1 year'
                : rewatchExclusionDays === 730
                ? '2 years'
                : `${rewatchExclusionDays} days`}
            </p>
            <select
              value={rewatchExclusionDays}
              onChange={(e) => setRewatchExclusionDays(parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="0">Always allow rewatches</option>
              <option value="30">1 month</option>
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">1 year (recommended)</option>
              <option value="730">2 years</option>
              <option value="1825">5 years</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Set to &quot;Always allow rewatches&quot; to include all previously watched
              movies in recommendations
            </p>
          </div>

          {/* Blocked Keywords */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Blocked Keywords
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Movies with these keywords won&apos;t appear in results (comma-separated)
            </p>
            <textarea
              value={blockedKeywords}
              onChange={(e) => setBlockedKeywords(e.target.value)}
              placeholder="e.g., violence, horror, scary"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preferred Streaming Services */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Streaming Services
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Select the streaming services you have access to. The AI will prioritize
              recommendations available on your selected services.
            </p>
            {loadingServices ? (
              <div className="text-sm text-gray-500">Loading streaming services...</div>
            ) : availableStreamingServices.length === 0 ? (
              <div className="text-sm text-gray-500">
                No streaming services found. Watch some movies to populate this list!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableStreamingServices.map((service) => (
                  <label
                    key={service.name}
                    className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={preferredStreamingServices.includes(service.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPreferredStreamingServices([
                            ...preferredStreamingServices,
                            service.name,
                          ]);
                        } else {
                          setPreferredStreamingServices(
                            preferredStreamingServices.filter((s) => s !== service.name)
                          );
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                    {service.logo_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${service.logo_path}`}
                        alt={service.name}
                        className="w-8 h-8 rounded object-contain flex-shrink-0"
                      />
                    )}
                    <span className="text-sm text-gray-900">{service.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="p-6 bg-gray-50">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
