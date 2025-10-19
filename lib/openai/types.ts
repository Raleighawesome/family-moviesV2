// OpenAI API Types

export interface OpenAIEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface MovieEmbeddingInput {
  title: string;
  overview?: string | null;
  genres?: string[];
  keywords?: string[];
}
