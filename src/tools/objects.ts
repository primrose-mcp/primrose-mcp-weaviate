/**
 * Object Tools
 *
 * MCP tools for Weaviate object CRUD operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all object-related tools
 */
export function registerObjectTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // List Objects
  // ===========================================================================
  server.tool(
    'weaviate_list_objects',
    `List objects from a Weaviate class with pagination.

Args:
  - className: Name of the class
  - limit: Number of objects to return (1-100, default: 20)
  - offset: Offset for pagination
  - include: Additional fields to include (vector, classification, featureProjection)
  - tenant: Tenant name for multi-tenant collections

Returns a paginated list of objects.`,
    {
      className: z.string().describe('Name of the class'),
      limit: z.number().int().min(1).max(100).default(20).describe('Number of objects to return'),
      offset: z.number().int().min(0).optional().describe('Offset for pagination'),
      include: z
        .array(z.enum(['vector', 'classification', 'featureProjection']))
        .optional()
        .describe('Additional fields to include'),
      tenant: z.string().optional().describe('Tenant name for multi-tenant collections'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, limit, offset, include, tenant, format }) => {
      try {
        const result = await client.listObjects(className, { limit, offset, include, tenant });
        return formatResponse(result, format, 'objects');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Object
  // ===========================================================================
  server.tool(
    'weaviate_get_object',
    `Get a single object by ID.

Args:
  - className: Name of the class
  - id: Object ID (UUID)
  - include: Additional fields to include (vector, classification, featureProjection)
  - tenant: Tenant name for multi-tenant collections

Returns the object with all its properties.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID (UUID)'),
      include: z
        .array(z.enum(['vector', 'classification', 'featureProjection']))
        .optional()
        .describe('Additional fields to include'),
      tenant: z.string().optional().describe('Tenant name for multi-tenant collections'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, id, include, tenant, format }) => {
      try {
        const object = await client.getObject(className, id, { include, tenant });
        return formatResponse(object, format, 'object');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Object
  // ===========================================================================
  server.tool(
    'weaviate_create_object',
    `Create a new object in a Weaviate class.

Args:
  - className: Name of the class
  - properties: Object properties as key-value pairs
  - id: Optional UUID for the object (auto-generated if not provided)
  - vector: Optional custom vector (required if class has no vectorizer)
  - tenant: Tenant name for multi-tenant collections

Returns the created object.`,
    {
      className: z.string().describe('Name of the class'),
      properties: z.record(z.string(), z.unknown()).describe('Object properties'),
      id: z.string().optional().describe('Object ID (UUID, auto-generated if not provided)'),
      vector: z.array(z.number()).optional().describe('Custom vector'),
      tenant: z.string().optional().describe('Tenant name for multi-tenant collections'),
    },
    async ({ className, properties, id, vector, tenant }) => {
      try {
        const object: Record<string, unknown> = {
          class: className,
          properties,
        };
        if (id) object.id = id;
        if (vector) object.vector = vector;
        if (tenant) object.tenant = tenant;

        const result = await client.createObject(object as unknown as Parameters<typeof client.createObject>[0]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Object created', object: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Object
  // ===========================================================================
  server.tool(
    'weaviate_update_object',
    `Update an existing object (replaces all properties).

Args:
  - className: Name of the class
  - id: Object ID (UUID)
  - properties: New object properties (replaces all existing)
  - vector: Optional new vector
  - tenant: Tenant name for multi-tenant collections

Returns the updated object.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID (UUID)'),
      properties: z.record(z.string(), z.unknown()).describe('New object properties (replaces all)'),
      vector: z.array(z.number()).optional().describe('New vector'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, properties, vector, tenant }) => {
      try {
        const result = await client.updateObject(className, id, properties as Record<string, unknown>, {
          vector,
          tenant,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Object updated', object: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Patch Object
  // ===========================================================================
  server.tool(
    'weaviate_patch_object',
    `Partially update an object (only provided properties are updated).

Args:
  - className: Name of the class
  - id: Object ID (UUID)
  - properties: Properties to update (existing properties not included are preserved)
  - tenant: Tenant name for multi-tenant collections

Returns confirmation of update.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID (UUID)'),
      properties: z.record(z.string(), z.unknown()).describe('Properties to update'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, properties, tenant }) => {
      try {
        await client.patchObject(className, id, properties as Record<string, unknown>, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Object ${id} patched` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Object
  // ===========================================================================
  server.tool(
    'weaviate_delete_object',
    `Delete an object by ID.

Args:
  - className: Name of the class
  - id: Object ID (UUID) to delete
  - tenant: Tenant name for multi-tenant collections

Returns confirmation of deletion.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID (UUID) to delete'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, tenant }) => {
      try {
        await client.deleteObject(className, id, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Object ${id} deleted` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Check Object Exists
  // ===========================================================================
  server.tool(
    'weaviate_object_exists',
    `Check if an object exists by ID (HEAD request).

Args:
  - className: Name of the class
  - id: Object ID (UUID) to check
  - tenant: Tenant name for multi-tenant collections

Returns whether the object exists.`,
    {
      className: z.string().describe('Name of the class'),
      id: z.string().describe('Object ID (UUID) to check'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, tenant }) => {
      try {
        const exists = await client.objectExists(className, id, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ exists, className, id }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
