/**
 * Cluster Tools
 *
 * MCP tools for Weaviate cluster and node operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all cluster-related tools
 */
export function registerClusterTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Get Meta
  // ===========================================================================
  server.tool(
    'weaviate_get_meta',
    `Get Weaviate server metadata including version and modules.

Returns server information including hostname, version, and configured modules.`,
    {
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ format }) => {
      try {
        const meta = await client.getMeta();
        return formatResponse(meta, format, 'meta');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Health Check - Live
  // ===========================================================================
  server.tool(
    'weaviate_is_live',
    `Check if Weaviate is alive (liveness probe).

This is a simple health check that returns ok if the server is running.`,
    {},
    async () => {
      try {
        const result = await client.isLive();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  live: result.status === 'ok',
                  status: result.status,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Health Check - Ready
  // ===========================================================================
  server.tool(
    'weaviate_is_ready',
    `Check if Weaviate is ready to accept requests (readiness probe).

This checks if the server is fully initialized and ready for queries.`,
    {},
    async () => {
      try {
        const result = await client.isReady();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ready: result.status === 'ok',
                  status: result.status,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Nodes
  // ===========================================================================
  server.tool(
    'weaviate_get_nodes',
    `Get information about all nodes in the Weaviate cluster.

Returns status, version, and statistics for each node.

Args:
  - output: Output verbosity (minimal or verbose)

Returns list of nodes with their status.`,
    {
      output: z.enum(['minimal', 'verbose']).optional().describe('Output verbosity'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ output, format }) => {
      try {
        const nodes = await client.getNodes({ output });
        return formatResponse({ items: nodes, count: nodes.length, hasMore: false }, format, 'nodes');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Cluster Statistics
  // ===========================================================================
  server.tool(
    'weaviate_get_cluster_statistics',
    `Get cluster-wide statistics.

Returns aggregate statistics across all nodes in the cluster.`,
    {
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ format }) => {
      try {
        const stats = await client.getClusterStatistics();
        return formatResponse(stats, format, 'statistics');
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
