import type { OpenAIEmbeddingResponse, EmbeddingOptions, MovieEmbeddingInput } from './types';

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.startsWith('sk-your-')) {
    throw new Error('OPENAI_API_KEY is not set or is still the example value. Please add your real OpenAI API key to .env.local');
  }
  return key;
}

/**
 * Rate limiting for OpenAI API
 * text-embedding-3-small has limits of:
 * - 5,000 RPM (requests per minute)
 * - 5,000,000 TPM (tokens per minute)
 */
class OpenAIRateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 4500; // Stay under 5000
  private readonly timeWindow = 60000; // 1 minute

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);

    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      return this.waitIfNeeded();
    }

    this.requests.push(now);
  }
}

const rateLimiter = new OpenAIRateLimiter();

/**
 * Retry logic for transient errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on authentication or invalid request errors
      if (error instanceof Error &&
          (error.message.includes('401') ||
           error.message.includes('400') ||
           error.message.includes('invalid'))) {
        throw error;
      }

      // Exponential backoff
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Generate embedding for arbitrary text
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const model = options.model || DEFAULT_MODEL;
  const dimensions = options.dimensions || DEFAULT_DIMENSIONS;

  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  await rateLimiter.waitIfNeeded();

  return withRetry(async () => {
    const response = await fetch(`${OPENAI_API_BASE}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getOpenAIKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model,
        dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('OpenAI API returned no embeddings');
    }

    return data.data[0].embedding;
  });
}

/**
 * Generate embedding for a movie by combining its metadata
 *
 * Strategy: Combine title, overview, genres, and top keywords into a rich text representation
 * This creates a semantic embedding that captures the movie's essence for similarity search
 */
export async function generateMovieEmbedding(
  movie: MovieEmbeddingInput,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  // Build a rich text representation of the movie
  const parts: string[] = [];

  // Title is most important - include it twice for weight
  if (movie.title) {
    parts.push(movie.title);
    parts.push(movie.title);
  }

  // Overview provides semantic context
  if (movie.overview) {
    parts.push(movie.overview);
  }

  // Genres help with categorical similarity
  if (movie.genres && movie.genres.length > 0) {
    parts.push(`Genres: ${movie.genres.join(', ')}`);
  }

  // Keywords add thematic context (limit to top 10 to avoid token bloat)
  if (movie.keywords && movie.keywords.length > 0) {
    const topKeywords = movie.keywords.slice(0, 10);
    parts.push(`Themes: ${topKeywords.join(', ')}`);
  }

  const combinedText = parts.join('\n\n');

  if (!combinedText.trim()) {
    throw new Error('Cannot generate movie embedding: no text content available');
  }

  return generateEmbedding(combinedText, options);
}

/**
 * Convert embedding array to PostgreSQL vector format
 * pgvector expects format: '[0.1, 0.2, 0.3, ...]'
 */
export function embeddingToVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Batch generate embeddings for multiple texts
 * Note: OpenAI API supports batching, but we process sequentially for simplicity
 * and to avoid hitting rate limits
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(text, options);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1, where 1 is identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
