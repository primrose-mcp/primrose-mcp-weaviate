/**
 * Tenant Tools
 *
 * MCP tools for Weaviate multi-tenancy operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all tenant-related tools
 */
export function registerTenantTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Get Tenants
  // ===========================================================================
  server.tool(
    'weaviate_get_tenants',
    `List all tenants for a multi-tenant class.

Args:
  - className: Name of the multi-tenant class

Returns list of tenants with their activity status.`,
    {
      className: z.string().describe('Name of the class'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, format }) => {
      try {
        const tenants = await client.getTenants(className);
        return formatResponse({ items: tenants, count: tenants.length, hasMore: false }, format, 'tenants');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Tenants
  // ===========================================================================
  server.tool(
    'weaviate_create_tenants',
    `Create one or more tenants for a multi-tenant class.

The class must have multi-tenancy enabled.

Args:
  - className: Name of the multi-tenant class
  - tenants: Array of tenant definitions with name and optional activityStatus

Returns the created tenants.`,
    {
      className: z.string().describe('Name of the class'),
      tenants: z
        .array(
          z.object({
            name: z.string().describe('Tenant name'),
            activityStatus: z
              .enum(['HOT', 'COLD', 'ACTIVE', 'INACTIVE'])
              .optional()
              .describe('Initial activity status'),
          })
        )
        .describe('Tenants to create'),
    },
    async ({ className, tenants }) => {
      try {
        const result = await client.createTenants(className, tenants);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Created ${result.length} tenant(s) for class '${className}'`,
                  tenants: result,
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
  // Update Tenants
  // ===========================================================================
  server.tool(
    'weaviate_update_tenants',
    `Update tenant activity status for a multi-tenant class.

Use this to activate (HOT/ACTIVE), deactivate (COLD/INACTIVE), freeze (FROZEN),
or offload (OFFLOADED) tenants.

Args:
  - className: Name of the multi-tenant class
  - tenants: Array of tenant updates with name and activityStatus

Returns confirmation of update.`,
    {
      className: z.string().describe('Name of the class'),
      tenants: z
        .array(
          z.object({
            name: z.string().describe('Tenant name'),
            activityStatus: z
              .enum(['HOT', 'COLD', 'FROZEN', 'ACTIVE', 'INACTIVE', 'OFFLOADED'])
              .describe('New activity status'),
          })
        )
        .describe('Tenant updates'),
    },
    async ({ className, tenants }) => {
      try {
        await client.updateTenants(className, tenants);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Updated ${tenants.length} tenant(s) for class '${className}'`,
                  updates: tenants,
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
  // Delete Tenants
  // ===========================================================================
  server.tool(
    'weaviate_delete_tenants',
    `Delete tenants from a multi-tenant class.

WARNING: This permanently deletes the tenants and all their data.

Args:
  - className: Name of the multi-tenant class
  - tenantNames: Array of tenant names to delete

Returns confirmation of deletion.`,
    {
      className: z.string().describe('Name of the class'),
      tenantNames: z.array(z.string()).describe('Tenant names to delete'),
    },
    async ({ className, tenantNames }) => {
      try {
        await client.deleteTenants(className, tenantNames);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Deleted ${tenantNames.length} tenant(s) from class '${className}'`,
                  deleted: tenantNames,
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
  // Tenant Exists
  // ===========================================================================
  server.tool(
    'weaviate_tenant_exists',
    `Check if a tenant exists in a multi-tenant class.

Args:
  - className: Name of the multi-tenant class
  - tenantName: Tenant name to check

Returns whether the tenant exists.`,
    {
      className: z.string().describe('Name of the class'),
      tenantName: z.string().describe('Tenant name to check'),
    },
    async ({ className, tenantName }) => {
      try {
        const exists = await client.tenantExists(className, tenantName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ exists, className, tenantName }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Activate Tenants
  // ===========================================================================
  server.tool(
    'weaviate_activate_tenants',
    `Activate (warm up) tenants to make them available for queries.

This is a convenience method that sets tenant status to ACTIVE.

Args:
  - className: Name of the multi-tenant class
  - tenantNames: Array of tenant names to activate

Returns confirmation of activation.`,
    {
      className: z.string().describe('Name of the class'),
      tenantNames: z.array(z.string()).describe('Tenant names to activate'),
    },
    async ({ className, tenantNames }) => {
      try {
        const tenants = tenantNames.map((name) => ({
          name,
          activityStatus: 'ACTIVE' as const,
        }));
        await client.updateTenants(className, tenants);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Activated ${tenantNames.length} tenant(s) for class '${className}'`,
                  activated: tenantNames,
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
  // Deactivate Tenants
  // ===========================================================================
  server.tool(
    'weaviate_deactivate_tenants',
    `Deactivate (cool down) tenants to reduce resource usage.

Deactivated tenants are still stored but not loaded into memory.
This is a convenience method that sets tenant status to INACTIVE.

Args:
  - className: Name of the multi-tenant class
  - tenantNames: Array of tenant names to deactivate

Returns confirmation of deactivation.`,
    {
      className: z.string().describe('Name of the class'),
      tenantNames: z.array(z.string()).describe('Tenant names to deactivate'),
    },
    async ({ className, tenantNames }) => {
      try {
        const tenants = tenantNames.map((name) => ({
          name,
          activityStatus: 'INACTIVE' as const,
        }));
        await client.updateTenants(className, tenants);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Deactivated ${tenantNames.length} tenant(s) for class '${className}'`,
                  deactivated: tenantNames,
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
}
