/**
 * Batch Tools
 *
 * MCP tools for Weaviate batch operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import type { WhereFilter } from '../types/entities.js';
import { formatError } from '../utils/formatters.js';

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
 * Register all batch-related tools
 */
export function registerBatchTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Batch Create Objects
  // ===========================================================================
  server.tool(
    'weaviate_batch_create',
    `Create multiple objects in a single batch request.

This is the most efficient way to import large amounts of data.

Args:
  - objects: Array of objects to create, each with:
    - class: Class name
    - properties: Object properties
    - id: Optional UUID
    - vector: Optional custom vector
    - tenant: Optional tenant name

Returns the batch operation results.`,
    {
      objects: z
        .array(
          z.object({
            class: z.string().describe('Class name'),
            properties: z.record(z.string(), z.unknown()).describe('Object properties'),
            id: z.string().optional().describe('Object ID (UUID)'),
            vector: z.array(z.number()).optional().describe('Custom vector'),
            tenant: z.string().optional().describe('Tenant name'),
          })
        )
        .describe('Array of objects to create'),
    },
    async ({ objects }) => {
      try {
        const result = await client.batchCreateObjects(
          objects as Parameters<typeof client.batchCreateObjects>[0]
        );
        const successful = result.filter((r) => !r.result?.errors?.error?.length).length;
        const failed = result.length - successful;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Batch create completed: ${successful} successful, ${failed} failed`,
                  total: result.length,
                  successful,
                  failed,
                  results: result,
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
  // Batch Delete Objects
  // ===========================================================================
  server.tool(
    'weaviate_batch_delete',
    `Delete multiple objects matching a filter in a single batch request.

Args:
  - className: Name of the class
  - where: Where filter to match objects for deletion
  - dryRun: If true, only report how many would be deleted without actually deleting
  - output: Output verbosity ('minimal' or 'verbose')

Returns the deletion results.`,
    {
      className: z.string().describe('Name of the class'),
      where: whereFilterSchema.describe('Where filter to match objects'),
      dryRun: z.boolean().optional().default(false).describe('Dry run mode (no actual deletion)'),
      output: z.enum(['minimal', 'verbose']).optional().default('minimal').describe('Output verbosity'),
    },
    async ({ className, where, dryRun, output }) => {
      try {
        const result = await client.batchDeleteObjects({
          match: { class: className, where: where as WhereFilter },
          dryRun,
          output,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: dryRun
                    ? `Dry run: ${result.results.matches} objects would be deleted`
                    : `Deleted ${result.results.successful} objects, ${result.results.failed} failed`,
                  dryRun,
                  matches: result.results.matches,
                  successful: result.results.successful,
                  failed: result.results.failed,
                  ...(output === 'verbose' && result.results.objects
                    ? { objects: result.results.objects }
                    : {}),
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
  // Batch Add References
  // ===========================================================================
  server.tool(
    'weaviate_batch_add_references',
    `Add multiple cross-references in a single batch request.

Args:
  - references: Array of references to add, each with:
    - from: Source beacon (weaviate://localhost/ClassName/uuid/propertyName)
    - to: Target beacon (weaviate://localhost/ClassName/uuid)

Returns the batch operation results.`,
    {
      references: z
        .array(
          z.object({
            from: z
              .string()
              .describe('Source beacon (weaviate://localhost/ClassName/uuid/propertyName)'),
            to: z.string().describe('Target beacon (weaviate://localhost/ClassName/uuid)'),
          })
        )
        .describe('Array of references to add'),
    },
    async ({ references }) => {
      try {
        const result = await client.batchAddReferences({ references });
        const successful = result.filter((r) => !r.result?.errors?.error?.length).length;
        const failed = result.length - successful;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Batch references completed: ${successful} successful, ${failed} failed`,
                  total: result.length,
                  successful,
                  failed,
                  results: result,
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
