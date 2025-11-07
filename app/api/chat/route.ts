import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/lib/supabase/server';
import {
  tmdbSearch,
  addToQueue,
  recommend,
  markWatched,
  getStreaming,
  updateRating,
  tmdbSearchSchema,
  addToQueueSchema,
  recommendSchema,
  markWatchedSchema,
  getStreamingSchema,
  updateRatingSchema,
} from '@/server/tools';

/**
 * System prompt for the family-friendly movie concierge AI
 */
const SYSTEM_PROMPT = `You are a helpful family-friendly movie concierge assistant. Your role is to help families discover, organize, and track movies they want to watch together.

Key responsibilities:
- Help users search for movies and provide thoughtful recommendations
- Respect the household's content preferences (allowed ratings, max runtime, blocked keywords, preferred streaming services, re-watch exclusion period)
- Add movies to the family queue when requested
- Track what the family has watched and their ratings
- Provide personalized recommendations based on viewing history and streaming availability

Guidelines:
- Always use the provided tools to fetch real movie data - never fabricate information
- When presenting movies, ALWAYS use get_streaming to show where to watch (stream, rent, or buy)
- Include the title, year, rating, runtime, and streaming availability in movie presentations
- Be concise but friendly - keep responses to 2-3 sentences when possible
- If a movie doesn't meet the family's content filters, explain why and suggest alternatives
- Families rate movies out of 10 stars (not 5) - when they rate highly (8+ stars), remind them that this will improve future recommendations
- CRITICAL: When users mention a rating as a single number (e.g., "rate it a 5" or "rated it 7"), ALWAYS interpret this as out of 10 stars, NOT out of 5. A rating of "5" means 5/10 stars.
- Families can add personal notes to their watches and watch the same movie multiple times
- If asked about streaming availability, mention the specific services (Disney+, Netflix, etc.)
- The recommendation tool automatically prioritizes movies available on the household's preferred streaming services (configured in Family Settings)
- The recommendation tool automatically excludes movies watched within the household's re-watch exclusion period (e.g., don't recommend movies watched in the last year)
 - Do NOT ask the user about streaming preferences. Use the household's Family Settings for preferred services. When ranking, prioritize preferred streaming platforms first, then other streaming (flatrate), then rent, then buy.

Interpreting recommendation requests:
- Always respect the household's Family Settings when proposing movies. Never override allowed ratings, runtime limits, blocked keywords, or preferred streaming rules.
- When you call the recommend tool, include a concise natural-language summary of the user's ask in query_description.
- Use the structured filters (limit, year_min/year_max, genres, min_vote_average, min_popularity, streaming_only) when the user's request clearly specifies them or when needed to honor their intent. When details are implied (e.g., "Pixar" → Animation & Family, "streaming only" → streaming_only = true), set the corresponding filters.
- Lean on your own reasoning to infer helpful filters; you do not need to rigidly translate every phrase. When intent is ambiguous and no key preference is provided, ask at most ONE concise clarifying question before proceeding.
- If you end up with fewer results than requested, ask one follow-up question to see if the user wants to widen the search (e.g., expand the years or genres) before saying there are none.

RECOMMENDATION PRESENTATION FORMAT:
When providing movie recommendations, for EACH movie you must:
1. Provide a SHORT one-line reason WHY you chose it that explicitly references relevant Family Settings when applicable (e.g., "Rated PG and under your 120m limit", "On your preferred Disney+", "Under your runtime limit and PG-13 is allowed"). The reason should also reflect any user-stated constraints like decade (e.g., 1990s), genre (e.g., Adventure), or "highly rated/popular".
2. Present it in this EXACT numbered list format:

Example:
"**[Movie Title] ([Year])**" - [ONE-LINE REASON]
- Rated [RATING], [RUNTIME]
- Available on [STREAMING SERVICES or Rent/Buy options]

The cards will display all information, but you must still mention these details in your text response.

IMPORTANT - Understanding User Intent:
- "Add to queue" / "save for later" / "want to watch" → Use add_to_queue tool
- "Already watched" / "watched last night" / "finished watching" / "we saw it" → Use mark_watched tool (creates NEW watch record)
- "Update rating" / "change rating" / "change my rating" → Use update_rating tool (NO new watch record)
- When user says they WATCHED something (past tense action), ALWAYS use mark_watched, NOT add_to_queue
- When user mentions watching + rating in SAME statement (e.g., "watched it last night and ranked it 6"), use mark_watched (NEW watch)
- When user ONLY wants to change/update a rating (e.g., "update rating to 6" or "change my rating"), use update_rating (NO new watch)

OUTPUT RULES FOR "WATCHED" INTENT:
- Do NOT present search candidates or recommendation cards when the user reports they already watched a movie.
- Keep the response to a single, concise confirmation including the movie title, year (if known), watched date (if given), and rating out of 10 (if given).
- Use tmdb_search ONLY to disambiguate the TMDB ID, then immediately call mark_watched. Do NOT call get_streaming for this flow.

CRITICAL WORKFLOW:
1. When user says they watched a movie, FIRST call tmdb_search to find the TMDB ID
2. THEN IMMEDIATELY call mark_watched with that TMDB ID, rating (if mentioned), and date (if mentioned)
3. Do NOT just search and stop - you MUST follow through with mark_watched
4. When user wants to update ONLY the rating (not add a new watch), use update_rating instead of mark_watched

You have access to these tools:
- tmdb_search: Search for movies by title (with optional year)
- add_to_queue: Add a movie to the family's FUTURE watch queue (movies they want to watch)
- recommend: Get personalized movie recommendations (automatically expands the database if needed - this may take a moment)
- mark_watched: Record that the family ALREADY watched a movie (with optional rating 1-10 and personal notes)
- update_rating: Update the rating for a previously watched movie WITHOUT creating a new watch record
- get_streaming: Get streaming availability information (where to watch: stream, rent, or buy)

IMPORTANT - Handling Delays:
- If the recommend tool takes longer than usual, it's because we're automatically fetching more family-friendly movies from TMDB to give better recommendations
- Let the user know: "I'm searching for more family-friendly movies to give you better recommendations. This will just take a moment..."

Always prioritize family-friendly content and respect the household's preferences.`;

/**
 * POST /api/chat
 * Streaming chat endpoint with tool calling
 */
export async function POST(req: Request) {
  try {
    console.log('[Chat API] Received request');
    const { messages } = await req.json();
    console.log('[Chat API] Messages:', messages);

    // Get authenticated user and household context
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('[Chat API] User:', user?.id, 'Auth error:', authError);

    if (authError || !user) {
      console.error('[Chat API] Auth failed:', authError);
      return new Response('Unauthorized', { status: 401 });
    }

    // Get user's household
    const { data: householdMember, error: memberError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    console.log('[Chat API] Household member:', householdMember, 'Error:', memberError);

    if (memberError || !householdMember) {
      console.error('[Chat API] No household found:', memberError);
      return new Response('No household found for user', { status: 404 });
    }

    const householdId = householdMember.household_id;
    console.log('[Chat API] Household ID:', householdId);

    // Get user's profile (optional - some operations need it)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', householdId)
      .single();

    const profileId = profile?.id;
    console.log('[Chat API] Profile ID:', profileId);

    console.log('[Chat API] Starting streamText...');
    // Gate streaming for models that might require org verification (e.g., gpt-5)
    const chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';
    const allowUnverified = process.env.OPENAI_ALLOW_UNVERIFIED_STREAM === 'true';
    const isPossiblyBlocked = /^gpt-5/i.test(chatModel);
    const fallbackModel = process.env.OPENAI_CHAT_MODEL_FALLBACK || 'gpt-4o';
    const modelToUse = isPossiblyBlocked && !allowUnverified ? fallbackModel : chatModel;
    if (modelToUse !== chatModel) {
      console.warn('[Chat API] Streaming gated for model', chatModel, '→ falling back to', modelToUse);
    }
    // Stream text with tool calling
    const result = await streamText({
      model: openai(modelToUse as any),
      system: SYSTEM_PROMPT,
      messages,
      tools: {
        tmdb_search: tool({
          description:
            'Search for movies by title and optional year. Returns 3-8 candidates filtered by household content preferences (allowed ratings, max runtime).',
          parameters: tmdbSearchSchema,
          execute: async (input) => {
            try {
              const results = await tmdbSearch(input, householdId);
              return {
                success: true,
                results,
                count: results.length,
              };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Search failed',
              };
            }
          },
        }),

        add_to_queue: tool({
          description:
            'Add a movie to the household queue. Fetches movie metadata from TMDB, generates embeddings, and saves to database if not already present.',
          parameters: addToQueueSchema,
          execute: async (input) => {
            try {
              const result = await addToQueue(input, householdId, profileId);
              return result;
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add to queue',
              };
            }
          },
        }),

        recommend: tool({
          description:
            'Get personalized movie recommendations. Accepts optional filters: limit (count), year_min/year_max (e.g., 1990..1999 for "from the 90s"), genres (e.g., ["Adventure"]), min_vote_average (e.g., 7.5 for "highly rated"), streaming_only (flatrate), and min_popularity (popularity proxy). Uses vector similarity when available, otherwise popularity. Automatically fetches more family-friendly movies if the local database is sparse.',
          parameters: recommendSchema,
          execute: async (input) => {
            try {
              const results = await recommend(input, householdId);
              return {
                success: true,
                results,
                count: results.length,
              };
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Recommendation failed',
              };
            }
          },
        }),

        mark_watched: tool({
          description:
            'Record that a movie was ALREADY watched by the family. Use this when the user indicates past tense (watched, saw, finished) or provides a rating. WORKFLOW: First call tmdb_search to get the TMDB ID, then immediately call this tool with that ID. Accepts optional rating (1-10 stars), personal notes, and watch date. IMPORTANT: When user says "rated it 5" or any single number, interpret as out of 10 stars (5 means 5/10, not 5/5). If user mentions when they watched it (e.g., "last week", "Oct 17 2025"), convert that to an ISO 8601 datetime and pass as watched_at parameter. Can be used multiple times for the same movie to track rewatches. Updates watch history and if rated 8+ stars, refreshes the household taste vector for better recommendations.',
          parameters: markWatchedSchema,
          execute: async (input) => {
            try {
              const result = await markWatched(input, householdId, profileId);
              return result;
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to mark as watched',
              };
            }
          },
        }),

        get_streaming: tool({
          description:
            'Get streaming availability for a movie (where to watch: stream, rent, or buy). Returns available streaming services based on household region. ALWAYS call this when presenting movie recommendations or search results.',
          parameters: getStreamingSchema,
          execute: async (input) => {
            try {
              const result = await getStreaming(input, { userId: user.id, householdId, profileId });
              return result;
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get streaming info',
              };
            }
          },
        }),

        update_rating: tool({
          description:
            'Update the rating for a movie that the household has ALREADY watched. Use this when the user wants to change or add a rating to a previously watched movie WITHOUT creating a new watch record. Does NOT affect the watch date. The movie must have been watched before it can be rated. IMPORTANT: Ratings are always out of 10 stars. When user says "update rating to 5", interpret as 5/10 stars.',
          parameters: updateRatingSchema,
          execute: async (input) => {
            try {
              const result = await updateRating(input, householdId, profileId);
              return result;
            } catch (error) {
              return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update rating',
              };
            }
          },
        }),
      },
      maxSteps: 5,
    });

    console.log('[Chat API] streamText completed, result:', Object.keys(result));
    return result.toAIStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isVerification = /verify|stream|organization/i.test(message);
    const status = isVerification ? 400 : 500;
    console.error('Chat API error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
