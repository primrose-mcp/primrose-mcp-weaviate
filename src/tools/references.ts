/**
 * Reference Tools
 *
 * MCP tools for Weaviate cross-reference operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError } from '../utils/formatters.js';

/**
 * Register all reference-related tools
 */
export function registerReferenceTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Add Reference
  // ===========================================================================
  server.tool(
    'weaviate_add_reference',
    `Add a cross-reference from one object to another.

Cross-references link objects together. The source object must have a reference
property defined in its class schema.

Args:
  - className: Source class name
  - id: Source object ID
  - propertyName: Name of the reference property
  - targetClass: Target class name
  - targetId: Target object ID
  - tenant: Tenant name for multi-tenant collections

Returns confirmation of reference addition.`,
    {
      className: z.string().describe('Source class name'),
      id: z.string().describe('Source object ID'),
      propertyName: z.string().describe('Reference property name'),
      targetClass: z.string().describe('Target class name'),
      targetId: z.string().describe('Target object ID'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, propertyName, targetClass, targetId, tenant }) => {
      try {
        const beacon = `weaviate://localhost/${targetClass}/${targetId}`;
        await client.addReference(className, id, propertyName, { beacon }, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Reference added from ${className}/${id} to ${targetClass}/${targetId}`,
                  from: { class: className, id, property: propertyName },
                  to: { class: targetClass, id: targetId },
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
  // Update References
  // ===========================================================================
  server.tool(
    'weaviate_update_references',
    `Replace all references for a property with a new set.

This replaces ALL existing references on the property with the provided list.

Args:
  - className: Source class name
  - id: Source object ID
  - propertyName: Name of the reference property
  - targets: Array of target references with class and id
  - tenant: Tenant name for multi-tenant collections

Returns confirmation of reference update.`,
    {
      className: z.string().describe('Source class name'),
      id: z.string().describe('Source object ID'),
      propertyName: z.string().describe('Reference property name'),
      targets: z
        .array(
          z.object({
            targetClass: z.string().describe('Target class name'),
            targetId: z.string().describe('Target object ID'),
          })
        )
        .describe('Array of targets'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, propertyName, targets, tenant }) => {
      try {
        const references = targets.map((t) => ({
          beacon: `weaviate://localhost/${t.targetClass}/${t.targetId}`,
        }));
        await client.updateReferences(className, id, propertyName, references, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `References updated for ${className}/${id}.${propertyName}`,
                  count: targets.length,
                  from: { class: className, id, property: propertyName },
                  to: targets,
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
  // Delete Reference
  // ===========================================================================
  server.tool(
    'weaviate_delete_reference',
    `Delete a specific cross-reference from an object.

Args:
  - className: Source class name
  - id: Source object ID
  - propertyName: Name of the reference property
  - targetClass: Target class name
  - targetId: Target object ID to remove
  - tenant: Tenant name for multi-tenant collections

Returns confirmation of reference deletion.`,
    {
      className: z.string().describe('Source class name'),
      id: z.string().describe('Source object ID'),
      propertyName: z.string().describe('Reference property name'),
      targetClass: z.string().describe('Target class name'),
      targetId: z.string().describe('Target object ID to remove'),
      tenant: z.string().optional().describe('Tenant name'),
    },
    async ({ className, id, propertyName, targetClass, targetId, tenant }) => {
      try {
        const beacon = `weaviate://localhost/${targetClass}/${targetId}`;
        await client.deleteReference(className, id, propertyName, { beacon }, { tenant });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Reference deleted from ${className}/${id} to ${targetClass}/${targetId}`,
                  from: { class: className, id, property: propertyName },
                  removed: { class: targetClass, id: targetId },
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
