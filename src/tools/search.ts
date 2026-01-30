/**
 * Search Tools
 *
 * MCP tools for Weaviate vector and keyword search operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import type { WhereFilter } from '../types/entities.js';
import { formatError, formatResponse } from '../utils/formatters.js';

// Define the where filter schema for Zod
const whereFilterSchema: z.ZodType<WhereFilter> = z.lazy(() =>
  z.object({
    operator: z.enum([
      'And',
      'Or',
      'Equal',
      'NotEqual',
      'GreaterThan',
      'GreaterThanEqual',
      'LessThan',
      'LessThanEqual',
      'Like',
      'WithinGeoRange',
      'IsNull',
      'ContainsAny',
      'ContainsAll',
    ]),
    operands: z.array(whereFilterSchema).optional(),
    path: z.array(z.string()).optional(),
    valueInt: z.number().optional(),
    valueNumber: z.number().optional(),
    valueBoolean: z.boolean().optional(),
    valueString: z.string().optional(),
    valueText: z.string().optional(),
    valueDate: z.string().optional(),
    valueIntArray: z.array(z.number()).optional(),
    valueNumberArray: z.array(z.number()).optional(),
    valueBooleanArray: z.array(z.boolean()).optional(),
    valueStringArray: z.array(z.string()).optional(),
    valueTextArray: z.array(z.string()).optional(),
    valueDateArray: z.array(z.string()).optional(),
  })
);

/**
 * Register all search-related tools
 */
export function registerSearchTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // GraphQL Query
  // ===========================================================================
  server.tool(
    'weaviate_graphql',
    `Execute a raw GraphQL query against Weaviate.

Use this for complex queries not covered by other search tools.

Args:
  - query: The GraphQL query string

Returns the GraphQL response.`,
    {
      query: z.string().describe('GraphQL query string'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ query, format }) => {
      try {
        const result = await client.graphqlQuery(query);
        return formatResponse(result, format, 'graphql');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Near Vector Search
  // ===========================================================================
  server.tool(
    'weaviate_near_vector',
    `Search for objects similar to a given vector.

Args:
  - className: Name of the class to search
  - vector: The query vector (array of numbers)
  - limit: Maximum number of results (default: 10)
  - certainty: Minimum certainty threshold (0-1)
  - distance: Maximum distance threshold
  - fields: Fields to return (default: _additional { id distance certainty })
  - where: Optional filter
  - tenant: Tenant name for multi-tenant collections

Returns matching objects sorted by similarity.`,
    {
      className: z.string().describe('Name of the class'),
      vector: z.array(z.number()).describe('Query vector'),
      limit: z.number().int().min(1).max(100).default(10).describe('Maximum results'),
      certainty: z.number().min(0).max(1).optional().describe('Minimum certainty (0-1)'),
      distance: z.number().optional().describe('Maximum distance'),
      fields: z.array(z.string()).optional().describe('Fields to return'),
      where: whereFilterSchema.optional().describe('Where filter'),
      tenant: z.string().optional().describe('Tenant name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, vector, limit, certainty, distance, fields, where, tenant, format }) => {
      try {
        const result = await client.nearVector(
          className,
          { vector, certainty, distance },
          { limit, fields, where: where as WhereFilter | undefined, tenant }
        );
        return formatResponse(result, format, 'search');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Near Text Search
  // ===========================================================================
  server.tool(
    'weaviate_near_text',
    `Search for objects semantically similar to text concepts.

Requires a text vectorizer module (text2vec-openai, text2vec-cohere, etc.)

Args:
  - className: Name of the class to search
  - concepts: Array of text concepts to search for
  - limit: Maximum number of results (default: 10)
  - certainty: Minimum certainty threshold (0-1)
  - distance: Maximum distance threshold
  - moveTo: Move results towards these concepts (optional)
  - moveAwayFrom: Move results away from these concepts (optional)
  - fields: Fields to return
  - where: Optional filter
  - tenant: Tenant name for multi-tenant collections

Returns matching objects sorted by semantic similarity.`,
    {
      className: z.string().describe('Name of the class'),
      concepts: z.array(z.string()).describe('Text concepts to search for'),
      limit: z.number().int().min(1).max(100).default(10).describe('Maximum results'),
      certainty: z.number().min(0).max(1).optional().describe('Minimum certainty (0-1)'),
      distance: z.number().optional().describe('Maximum distance'),
      moveTo: z
        .object({
          concepts: z.array(z.string()).optional(),
          force: z.number().min(0).max(1),
        })
        .optional()
        .describe('Move towards these concepts'),
      moveAwayFrom: z
        .object({
          concepts: z.array(z.string()).optional(),
          force: z.number().min(0).max(1),
        })
        .optional()
        .describe('Move away from these concepts'),
      fields: z.array(z.string()).optional().describe('Fields to return'),
      where: whereFilterSchema.optional().describe('Where filter'),
      tenant: z.string().optional().describe('Tenant name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({
      className,
      concepts,
      limit,
      certainty,
      distance,
      moveTo,
      moveAwayFrom,
      fields,
      where,
      tenant,
      format,
    }) => {
      try {
        const result = await client.nearText(
          className,
          { concepts, certainty, distance, moveTo, moveAwayFrom },
          { limit, fields, where: where as WhereFilter | undefined, tenant }
        );
        return formatResponse(result, format, 'search');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Near Object Search
  // ===========================================================================
  server.tool(
    'weaviate_near_object',
    `Search for objects similar to an existing object by ID.

Args:
  - className: Name of the class to search
  - id: Object ID to find similar objects to
  - limit: Maximum number of results (default: 10)
  - certainty: Minimum certainty threshold (0-1)
  - distance: Maximum distance threshold
  - fields: Fields to return
  - where: Optional filter
  - tenant: Tenant name for multi-tenant collections

Returns matching objects sorted by similarity.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID to find similar objects to'),
      limit: z.number().int().min(1).max(100).default(10).describe('Maximum results'),
      certainty: z.number().min(0).max(1).optional().describe('Minimum certainty (0-1)'),
      distance: z.number().optional().describe('Maximum distance'),
      fields: z.array(z.string()).optional().describe('Fields to return'),
      where: whereFilterSchema.optional().describe('Where filter'),
      tenant: z.string().optional().describe('Tenant name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, id, limit, certainty, distance, fields, where, tenant, format }) => {
      try {
        const result = await client.nearObject(
          className,
          { id, certainty, distance },
          { limit, fields, where: where as WhereFilter | undefined, tenant }
        );
        return formatResponse(result, format, 'search');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Hybrid Search
  // ===========================================================================
  server.tool(
    'weaviate_hybrid',
    `Perform hybrid search combining vector search with keyword search (BM25).

Args:
  - className: Name of the class to search
  - query: The search query text
  - alpha: Balance between vector (1) and keyword (0) search (default: 0.5)
  - vector: Optional custom vector (if not using text vectorizer)
  - properties: Properties to search in for BM25
  - fusionType: How to fuse results (rankedFusion or relativeScoreFusion)
  - limit: Maximum number of results (default: 10)
  - fields: Fields to return
  - where: Optional filter
  - tenant: Tenant name for multi-tenant collections

Returns matching objects combining both search methods.`,
    {
      className: z.string().describe('Name of the class'),
      query: z.string().describe('Search query text'),
      alpha: z.number().min(0).max(1).default(0.5).describe('Vector (1) vs keyword (0) balance'),
      vector: z.array(z.number()).optional().describe('Custom query vector'),
      properties: z.array(z.string()).optional().describe('Properties to search for BM25'),
      fusionType: z
        .enum(['rankedFusion', 'relativeScoreFusion'])
        .optional()
        .describe('Result fusion method'),
      limit: z.number().int().min(1).max(100).default(10).describe('Maximum results'),
      fields: z.array(z.string()).optional().describe('Fields to return'),
      where: whereFilterSchema.optional().describe('Where filter'),
      tenant: z.string().optional().describe('Tenant name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({
      className,
      query,
      alpha,
      vector,
      properties,
      fusionType,
      limit,
      fields,
      where,
      tenant,
      format,
    }) => {
      try {
        const result = await client.hybridSearch(
          className,
          { query, alpha, vector, properties, fusionType },
          { limit, fields, where: where as WhereFilter | undefined, tenant }
        );
        return formatResponse(result, format, 'search');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // BM25 Keyword Search
  // ===========================================================================
  server.tool(
    'weaviate_bm25',
    `Perform BM25 keyword search (no vector search).

Args:
  - className: Name of the class to search
  - query: The search query text
  - properties: Properties to search in
  - limit: Maximum number of results (default: 10)
  - fields: Fields to return
  - where: Optional filter
  - tenant: Tenant name for multi-tenant collections

Returns matching objects based on keyword relevance.`,
    {
      className: z.string().describe('Name of the class'),
      query: z.string().describe('Search query text'),
      properties: z.array(z.string()).optional().describe('Properties to search in'),
      limit: z.number().int().min(1).max(100).default(10).describe('Maximum results'),
      fields: z.array(z.string()).optional().describe('Fields to return'),
      where: whereFilterSchema.optional().describe('Where filter'),
      tenant: z.string().optional().describe('Tenant name'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, query, properties, limit, fields, where, tenant, format }) => {
      try {
        const result = await client.bm25Search(
          className,
          { query, properties },
          { limit, fields, where: where as WhereFilter | undefined, tenant }
        );
        return formatResponse(result, format, 'search');
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
