# Chat API Endpoint

## Overview

The `/api/chat` endpoint provides streaming AI chat with tool calling capabilities. It uses GPT-4 to help families discover, organize, and track movies.

## Authentication

**Required:** The endpoint requires an authenticated user with an associated household.

The endpoint:
1. Extracts the user from the Supabase auth session
2. Looks up the user's household from `household_members`
3. Optionally gets the user's profile ID for personalized operations

## Request Format

```typescript
POST /api/chat
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Find family-friendly movies about animals"
    }
  ]
}
```

## Response Format

The endpoint returns a streaming response using the Vercel AI SDK's data stream protocol.

## Available Tools

The AI has access to 4 tools:

### 1. tmdb_search
Search for movies by title and optional year.

**Parameters:**
```typescript
{
  query: string;    // Movie title to search for
  year?: number;    // Optional release year
}
```

**Example:**
```
User: "Search for The Lion King from 1994"
AI calls: tmdb_search({ query: "The Lion King", year: 1994 })
```

### 2. add_to_queue
Add a movie to the household's watch queue.

**Parameters:**
```typescript
{
  tmdb_id: number;  // TMDB movie ID
}
```

**Example:**
```
User: "Add that to our queue"
AI calls: add_to_queue({ tmdb_id: 8587 })
```

### 3. recommend
Get personalized movie recommendations.

**Parameters:**
```typescript
{
  limit?: number;   // Number of recommendations (1-24, default 10)
}
```

**Example:**
```
User: "Recommend some movies for us"
AI calls: recommend({ limit: 10 })
```

### 4. mark_watched
Mark a movie as watched with optional rating.

**Parameters:**
```typescript
{
  tmdb_id: number;  // TMDB movie ID
  rating?: number;  // Optional rating 1-5
}
```

**Example:**
```
User: "We watched The Lion King, it was amazing - 5 stars!"
AI calls: mark_watched({ tmdb_id: 8587, rating: 5 })
```

## System Prompt

The AI is configured with a family-friendly movie concierge persona that:
- Respects household content preferences (allowed ratings, max runtime)
- Uses tools to fetch real data (never fabricates information)
- Provides concise, helpful responses
- Mentions streaming availability when known
- Reminds users that high ratings improve future recommendations

## Testing

### Prerequisites
1. Start Supabase: `supabase start`
2. Ensure you have a user in the `auth.users` table
3. Ensure the user has a household in `household_members`
4. Start Next.js dev server: `pnpm dev`

### Manual Testing with curl

```bash
# Get auth token from Supabase (replace with your user credentials)
# You'll need to implement auth first (Phase 9)

curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=YOUR_TOKEN_HERE" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Search for Toy Story"
      }
    ]
  }'
```

### UI Testing

Once the chat UI is built (Phase 10), you can test interactively:
- Navigate to `/chat`
- Type: "Find family movies about space"
- The AI should call `tmdb_search` and show results
- Type: "Add the first one to my queue"
- The AI should call `add_to_queue`

## Error Handling

The endpoint handles errors gracefully:
- **401 Unauthorized**: User not authenticated
- **404 Not Found**: User has no household
- **500 Internal Server Error**: Tool execution failed or other error

All tool errors are caught and returned to the AI as structured error responses, allowing it to explain issues to the user in natural language.

## Performance

- **Model:** GPT-4o (fast, high quality)
- **Max Steps:** 5 tool calls per turn
- **Streaming:** Responses stream in real-time
- **Rate Limiting:** Inherits OpenAI rate limits (handled by exponential backoff in tools)

## Security

- RLS policies enforce household isolation at the database level
- Tools automatically inject household context from auth
- No cross-household data leakage possible
- Service role key never exposed to client
