/**
 * Weaviate MCP Server - Main Entry Point
 *
 * This file sets up the MCP server using Cloudflare's Agents SDK.
 * It supports both stateless (McpServer) and stateful (McpAgent) modes.
 *
 * MULTI-TENANT ARCHITECTURE:
 * Tenant credentials (API keys, Weaviate URLs, etc.) are parsed from request headers,
 * allowing a single server deployment to serve multiple customers.
 *
 * Required Headers:
 * - X-Weaviate-URL: Weaviate instance URL
 *
 * Optional Headers:
 * - X-Weaviate-API-Key: Weaviate API key for authentication
 * - X-OpenAI-Api-Key: OpenAI API key for text2vec-openai vectorizer
 * - X-Cohere-Api-Key: Cohere API key for text2vec-cohere vectorizer
 * - X-HuggingFace-Api-Key: HuggingFace API key for text2vec-huggingface vectorizer
 * - X-Anthropic-Api-Key: Anthropic API key for generative modules
 * - X-Azure-Api-Key: Azure API key for Azure OpenAI
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { createWeaviateClient } from './client.js';
import {
  registerSchemaTools,
  registerObjectTools,
  registerBatchTools,
  registerSearchTools,
  registerReferenceTools,
  registerTenantTools,
  registerBackupTools,
  registerClusterTools,
  registerClassificationTools,
} from './tools/index.js';
import {
  type Env,
  type TenantCredentials,
  parseTenantCredentials,
  validateCredentials,
} from './types/env.js';

// =============================================================================
// MCP Server Configuration
// =============================================================================

const SERVER_NAME = 'primrose-mcp-weaviate';
const SERVER_VERSION = '1.0.0';

// =============================================================================
// MCP Agent (Stateful - uses Durable Objects)
// =============================================================================

/**
 * McpAgent provides stateful MCP sessions backed by Durable Objects.
 *
 * NOTE: For multi-tenant deployments, use the stateless mode (Option 2) instead.
 * The stateful McpAgent is better suited for single-tenant deployments where
 * credentials can be stored as wrangler secrets.
 *
 * @deprecated For multi-tenant support, use stateless mode with per-request credentials
 */
export class WeaviateMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  async init() {
    // NOTE: Stateful mode requires credentials to be configured differently.
    // For multi-tenant, use the stateless /mcp endpoint instead.
    throw new Error(
      'Stateful mode (McpAgent) is not supported for multi-tenant deployments. ' +
        'Use the stateless /mcp endpoint with X-Weaviate-URL header instead.'
    );
  }
}

// =============================================================================
// Stateless MCP Server (Recommended - no Durable Objects needed)
// =============================================================================

/**
 * Creates a stateless MCP server instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides credentials via headers, allowing
 * a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
function createStatelessServer(credentials: TenantCredentials): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Create client with tenant-specific credentials
  const client = createWeaviateClient(credentials);

  // Register all tool categories
  registerSchemaTools(server, client);
  registerObjectTools(server, client);
  registerBatchTools(server, client);
  registerSearchTools(server, client);
  registerReferenceTools(server, client);
  registerTenantTools(server, client);
  registerBackupTools(server, client);
  registerClusterTools(server, client);
  registerClassificationTools(server, client);

  // Test connection tool
  server.tool(
    'weaviate_test_connection',
    'Test the connection to the Weaviate instance',
    {},
    async () => {
      try {
        const result = await client.testConnection();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// =============================================================================
// Worker Export
// =============================================================================

export default {
  /**
   * Main fetch handler for the Worker
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', server: SERVER_NAME }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ==========================================================================
    // Stateless MCP with Streamable HTTP (Recommended for multi-tenant)
    // ==========================================================================
    if (url.pathname === '/mcp' && request.method === 'POST') {
      // Parse tenant credentials from request headers
      const credentials = parseTenantCredentials(request);

      // Validate credentials are present
      try {
        validateCredentials(credentials);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid credentials',
            required_headers: ['X-Weaviate-URL'],
            optional_headers: [
              'X-Weaviate-API-Key',
              'X-OpenAI-Api-Key',
              'X-Cohere-Api-Key',
              'X-HuggingFace-Api-Key',
              'X-Anthropic-Api-Key',
              'X-Azure-Api-Key',
            ],
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Create server with tenant-specific credentials
      const server = createStatelessServer(credentials);

      // Import and use createMcpHandler for streamable HTTP
      const { createMcpHandler } = await import('agents/mcp');
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    // SSE endpoint for legacy clients
    if (url.pathname === '/sse') {
      return new Response('SSE endpoint requires Durable Objects. Enable in wrangler.jsonc.', {
        status: 501,
      });
    }

    // Default response
    return new Response(
      JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: 'Weaviate MCP Server - Vector Database Operations',
        endpoints: {
          mcp: '/mcp (POST) - Streamable HTTP MCP endpoint',
          health: '/health - Health check',
        },
        authentication: {
          description: 'Pass tenant credentials via request headers',
          required_headers: {
            'X-Weaviate-URL': 'Weaviate instance URL (e.g., https://your-cluster.weaviate.network)',
          },
          optional_headers: {
            'X-Weaviate-API-Key': 'Weaviate API key for authentication',
            'X-OpenAI-Api-Key': 'OpenAI API key for text2vec-openai vectorizer',
            'X-Cohere-Api-Key': 'Cohere API key for text2vec-cohere vectorizer',
            'X-HuggingFace-Api-Key': 'HuggingFace API key for text2vec-huggingface vectorizer',
            'X-Anthropic-Api-Key': 'Anthropic API key for generative modules',
            'X-Azure-Api-Key': 'Azure API key for Azure OpenAI',
          },
        },
        tools: {
          schema: [
            'weaviate_get_schema',
            'weaviate_get_class',
            'weaviate_create_class',
            'weaviate_update_class',
            'weaviate_delete_class',
            'weaviate_add_property',
          ],
          objects: [
            'weaviate_list_objects',
            'weaviate_get_object',
            'weaviate_create_object',
            'weaviate_update_object',
            'weaviate_patch_object',
            'weaviate_delete_object',
            'weaviate_object_exists',
          ],
          batch: [
            'weaviate_batch_create',
            'weaviate_batch_delete',
            'weaviate_batch_add_references',
          ],
          search: [
            'weaviate_graphql',
            'weaviate_near_vector',
            'weaviate_near_text',
            'weaviate_near_object',
            'weaviate_hybrid',
            'weaviate_bm25',
          ],
          references: [
            'weaviate_add_reference',
            'weaviate_update_references',
            'weaviate_delete_reference',
          ],
          tenants: [
            'weaviate_get_tenants',
            'weaviate_create_tenants',
            'weaviate_update_tenants',
            'weaviate_delete_tenants',
            'weaviate_tenant_exists',
            'weaviate_activate_tenants',
            'weaviate_deactivate_tenants',
          ],
          backups: [
            'weaviate_create_backup',
            'weaviate_get_backup_status',
            'weaviate_restore_backup',
            'weaviate_get_restore_status',
            'weaviate_cancel_backup',
          ],
          cluster: [
            'weaviate_get_meta',
            'weaviate_is_live',
            'weaviate_is_ready',
            'weaviate_get_nodes',
            'weaviate_get_cluster_statistics',
          ],
          classification: [
            'weaviate_create_classification',
            'weaviate_get_classification',
          ],
          connection: ['weaviate_test_connection'],
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
