/**
 * Environment Bindings for Weaviate MCP Server
 *
 * Type definitions for Cloudflare Worker environment variables and bindings.
 *
 * MULTI-TENANT ARCHITECTURE:
 * This server supports multiple tenants. Tenant-specific credentials (API keys,
 * Weaviate URLs, etc.) are passed via request headers, NOT stored in wrangler
 * secrets. This allows a single server instance to serve multiple customers.
 *
 * Request Headers:
 * - X-Weaviate-URL: Weaviate instance URL
 * - X-Weaviate-API-Key: Weaviate API key
 * - X-OpenAI-Api-Key: (Optional) OpenAI API key for vectorization
 * - X-Cohere-Api-Key: (Optional) Cohere API key for vectorization
 * - X-HuggingFace-Api-Key: (Optional) HuggingFace API key for vectorization
 */

// =============================================================================
// Tenant Credentials (parsed from request headers)
// =============================================================================

export interface TenantCredentials {
  /** Weaviate instance URL (from X-Weaviate-URL header) */
  weaviateUrl?: string;

  /** Weaviate API Key (from X-Weaviate-API-Key header) */
  apiKey?: string;

  /** OpenAI API Key for text2vec-openai (from X-OpenAI-Api-Key header) */
  openaiApiKey?: string;

  /** Cohere API Key for text2vec-cohere (from X-Cohere-Api-Key header) */
  cohereApiKey?: string;

  /** HuggingFace API Key for text2vec-huggingface (from X-HuggingFace-Api-Key header) */
  huggingfaceApiKey?: string;

  /** Anthropic API Key for generative modules (from X-Anthropic-Api-Key header) */
  anthropicApiKey?: string;

  /** Azure OpenAI API Key (from X-Azure-Api-Key header) */
  azureApiKey?: string;
}

/**
 * Parse tenant credentials from request headers
 */
export function parseTenantCredentials(request: Request): TenantCredentials {
  const headers = request.headers;

  return {
    weaviateUrl: headers.get('X-Weaviate-URL') || undefined,
    apiKey: headers.get('X-Weaviate-API-Key') || undefined,
    openaiApiKey: headers.get('X-OpenAI-Api-Key') || undefined,
    cohereApiKey: headers.get('X-Cohere-Api-Key') || undefined,
    huggingfaceApiKey: headers.get('X-HuggingFace-Api-Key') || undefined,
    anthropicApiKey: headers.get('X-Anthropic-Api-Key') || undefined,
    azureApiKey: headers.get('X-Azure-Api-Key') || undefined,
  };
}

/**
 * Validate that required credentials are present
 */
export function validateCredentials(credentials: TenantCredentials): void {
  if (!credentials.weaviateUrl) {
    throw new Error('Missing X-Weaviate-URL header. Provide your Weaviate instance URL.');
  }
}

// =============================================================================
// Environment Configuration (from wrangler.jsonc vars and bindings)
// =============================================================================

export interface Env {
  // ===========================================================================
  // Environment Variables (from wrangler.jsonc vars)
  // ===========================================================================

  /** Maximum character limit for responses */
  CHARACTER_LIMIT: string;

  /** Default page size for list operations */
  DEFAULT_PAGE_SIZE: string;

  /** Maximum page size allowed */
  MAX_PAGE_SIZE: string;

  // ===========================================================================
  // Bindings
  // ===========================================================================

  /** KV namespace for caching (optional) */
  CACHE_KV?: KVNamespace;

  /** Durable Object namespace for MCP sessions (optional) */
  MCP_SESSIONS?: DurableObjectNamespace;

  /** Cloudflare AI binding (optional) */
  AI?: Ai;
}

// ===========================================================================
// Helper Functions
// ===========================================================================

/**
 * Get a numeric environment value with a default
 */
export function getEnvNumber(env: Env, key: keyof Env, defaultValue: number): number {
  const value = env[key];
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Get the character limit from environment
 */
export function getCharacterLimit(env: Env): number {
  return getEnvNumber(env, 'CHARACTER_LIMIT', 50000);
}

/**
 * Get the default page size from environment
 */
export function getDefaultPageSize(env: Env): number {
  return getEnvNumber(env, 'DEFAULT_PAGE_SIZE', 20);
}

/**
 * Get the maximum page size from environment
 */
export function getMaxPageSize(env: Env): number {
  return getEnvNumber(env, 'MAX_PAGE_SIZE', 100);
}
