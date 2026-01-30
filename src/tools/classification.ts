/**
 * Classification Tools
 *
 * MCP tools for Weaviate classification operations.
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
 * Register all classification-related tools
 */
export function registerClassificationTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Create Classification
  // ===========================================================================
  server.tool(
    'weaviate_create_classification',
    `Start a classification task to automatically classify objects.

Classification types:
- knn: k-nearest neighbors based on vector similarity
- text2vec-contextionary-contextual: Contextual classification using contextionary
- zeroshot: Zero-shot classification

Args:
  - type: Classification type (knn, text2vec-contextionary-contextual, zeroshot)
  - className: Class to classify objects in
  - classifyProperties: Properties to classify (reference properties)
  - basedOnProperties: Properties to base classification on
  - k: Number of neighbors for knn (default: 3)
  - sourceWhere: Filter for source objects to classify
  - targetWhere: Filter for target objects to use as references
  - trainingSetWhere: Filter for training set (knn)

Returns the classification task status.`,
    {
      type: z
        .enum(['knn', 'text2vec-contextionary-contextual', 'zeroshot'])
        .describe('Classification type'),
      className: z.string().describe('Class to classify'),
      classifyProperties: z.array(z.string()).describe('Reference properties to classify'),
      basedOnProperties: z.array(z.string()).describe('Properties to base classification on'),
      k: z.number().int().min(1).optional().describe('Number of neighbors for knn'),
      sourceWhere: whereFilterSchema.optional().describe('Filter for source objects'),
      targetWhere: whereFilterSchema.optional().describe('Filter for target objects'),
      trainingSetWhere: whereFilterSchema.optional().describe('Filter for training set'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({
      type,
      className,
      classifyProperties,
      basedOnProperties,
      k,
      sourceWhere,
      targetWhere,
      trainingSetWhere,
      format,
    }) => {
      try {
        const request: Parameters<typeof client.createClassification>[0] = {
          type,
          class: className,
          classifyProperties,
          basedOnProperties,
        };

        if (k !== undefined) {
          request.settings = { k };
        }

        if (sourceWhere || targetWhere || trainingSetWhere) {
          request.filters = {
            sourceWhere: sourceWhere as WhereFilter | undefined,
            targetWhere: targetWhere as WhereFilter | undefined,
            trainingSetWhere: trainingSetWhere as WhereFilter | undefined,
          };
        }

        const result = await client.createClassification(request);
        return formatResponse(result, format, 'classification');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Classification Status
  // ===========================================================================
  server.tool(
    'weaviate_get_classification',
    `Get the status of a classification task.

Args:
  - id: Classification task ID

Returns the classification status and results.`,
    {
      id: z.string().describe('Classification task ID'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ id, format }) => {
      try {
        const result = await client.getClassification(id);
        return formatResponse(result, format, 'classification');
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
