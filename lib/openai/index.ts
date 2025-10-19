// OpenAI Integration Module

export * from './types';
export * from './embeddings';

// Re-export commonly used functions
export {
  generateEmbedding,
  generateMovieEmbedding,
  generateEmbeddingsBatch,
  embeddingToVector,
  cosineSimilarity,
} from './embeddings';
