/**
 * Schema Tools
 *
 * MCP tools for Weaviate schema/collection management.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all schema-related tools
 */
export function registerSchemaTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Get Schema
  // ===========================================================================
  server.tool(
    'weaviate_get_schema',
    `Get the full Weaviate schema with all collections/classes.

Returns the complete schema including all classes, their properties, vectorizers, and configurations.`,
    {
      format: z.enum(['json', 'markdown']).default('json').describe('Response format'),
    },
    async ({ format }) => {
      try {
        const schema = await client.getSchema();
        return formatResponse(schema, format, 'schema');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Class
  // ===========================================================================
  server.tool(
    'weaviate_get_class',
    `Get a specific class/collection from the schema.

Args:
  - className: The name of the class to retrieve

Returns the class configuration including properties, vectorizer, and module config.`,
    {
      className: z.string().describe('Name of the class to retrieve'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ className, format }) => {
      try {
        const cls = await client.getClass(className);
        return formatResponse(cls, format, 'class');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Class
  // ===========================================================================
  server.tool(
    'weaviate_create_class',
    `Create a new class/collection in Weaviate.

Args:
  - className: Name of the class (must start with uppercase)
  - description: Description of the class
  - vectorizer: Vectorizer module (text2vec-openai, text2vec-cohere, text2vec-huggingface, none)
  - properties: Array of property definitions
  - moduleConfig: Module-specific configuration
  - vectorIndexType: Type of vector index (hnsw, flat)
  - multiTenancyEnabled: Enable multi-tenancy for this class

Returns the created class configuration.`,
    {
      className: z.string().describe('Name of the class (must start with uppercase)'),
      description: z.string().optional().describe('Description of the class'),
      vectorizer: z
        .enum(['text2vec-openai', 'text2vec-cohere', 'text2vec-huggingface', 'text2vec-contextionary', 'none'])
        .optional()
        .describe('Vectorizer module'),
      properties: z
        .array(
          z.object({
            name: z.string().describe('Property name'),
            dataType: z.array(z.string()).describe('Data types (e.g., ["text"], ["int"])'),
            description: z.string().optional().describe('Property description'),
            indexFilterable: z.boolean().optional().describe('Enable filtering on this property'),
            indexSearchable: z.boolean().optional().describe('Enable full-text search on this property'),
            tokenization: z.string().optional().describe('Tokenization method (word, lowercase, whitespace, field)'),
          })
        )
        .optional()
        .describe('Array of property definitions'),
      moduleConfig: z.record(z.string(), z.unknown()).optional().describe('Module-specific configuration'),
      vectorIndexType: z.enum(['hnsw', 'flat']).optional().describe('Vector index type'),
      multiTenancyEnabled: z.boolean().optional().describe('Enable multi-tenancy'),
      replicationFactor: z.number().optional().describe('Replication factor'),
    },
    async ({
      className,
      description,
      vectorizer,
      properties,
      moduleConfig,
      vectorIndexType,
      multiTenancyEnabled,
      replicationFactor,
    }) => {
      try {
        const classConfig: Record<string, unknown> = {
          class: className,
        };
        if (description) classConfig.description = description;
        if (vectorizer) classConfig.vectorizer = vectorizer;
        if (properties) classConfig.properties = properties;
        if (moduleConfig) classConfig.moduleConfig = moduleConfig;
        if (vectorIndexType) classConfig.vectorIndexType = vectorIndexType;
        if (multiTenancyEnabled !== undefined) {
          classConfig.multiTenancyConfig = { enabled: multiTenancyEnabled };
        }
        if (replicationFactor !== undefined) {
          classConfig.replicationConfig = { factor: replicationFactor };
        }

        const result = await client.createClass(classConfig as unknown as Parameters<typeof client.createClass>[0]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Class created', class: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Class
  // ===========================================================================
  server.tool(
    'weaviate_update_class',
    `Update an existing class/collection configuration.

Note: Not all properties can be updated after creation. Typically you can update:
- description
- invertedIndexConfig
- replicationConfig
- vectorIndexConfig (some settings)

Args:
  - className: Name of the class to update
  - description: New description
  - invertedIndexConfig: Inverted index configuration
  - replicationConfig: Replication configuration

Returns the updated class configuration.`,
    {
      className: z.string().describe('Name of the class to update'),
      description: z.string().optional().describe('New description'),
      invertedIndexConfig: z
        .object({
          bm25: z
            .object({
              b: z.number().optional(),
              k1: z.number().optional(),
            })
            .optional(),
          stopwords: z
            .object({
              preset: z.string().optional(),
              additions: z.array(z.string()).optional(),
              removals: z.array(z.string()).optional(),
            })
            .optional(),
        })
        .optional()
        .describe('Inverted index configuration'),
      replicationFactor: z.number().optional().describe('New replication factor'),
    },
    async ({ className, description, invertedIndexConfig, replicationFactor }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (description !== undefined) updates.description = description;
        if (invertedIndexConfig) updates.invertedIndexConfig = invertedIndexConfig;
        if (replicationFactor !== undefined) {
          updates.replicationConfig = { factor: replicationFactor };
        }

        const result = await client.updateClass(className, updates as Parameters<typeof client.updateClass>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Class updated', class: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Class
  // ===========================================================================
  server.tool(
    'weaviate_delete_class',
    `Delete a class/collection and all its data.

WARNING: This permanently deletes the class and all objects in it.

Args:
  - className: Name of the class to delete

Returns confirmation of deletion.`,
    {
      className: z.string().describe('Name of the class to delete'),
    },
    async ({ className }) => {
      try {
        await client.deleteClass(className);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Class '${className}' deleted` }, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Add Property
  // ===========================================================================
  server.tool(
    'weaviate_add_property',
    `Add a new property to an existing class.

Args:
  - className: Name of the class
  - name: Property name
  - dataType: Array of data types (e.g., ["text"], ["int"], ["boolean"])
  - description: Property description
  - indexFilterable: Enable filtering on this property
  - indexSearchable: Enable full-text search
  - tokenization: Tokenization method (word, lowercase, whitespace, field)

Returns confirmation of property addition.`,
    {
      className: z.string().describe('Name of the class'),
      name: z.string().describe('Property name'),
      dataType: z.array(z.string()).describe('Data types (e.g., ["text"], ["int"])'),
      description: z.string().optional().describe('Property description'),
      indexFilterable: z.boolean().optional().describe('Enable filtering'),
      indexSearchable: z.boolean().optional().describe('Enable full-text search'),
      tokenization: z
        .enum(['word', 'lowercase', 'whitespace', 'field'])
        .optional()
        .describe('Tokenization method'),
    },
    async ({ className, name, dataType, description, indexFilterable, indexSearchable, tokenization }) => {
      try {
        const property: Record<string, unknown> = { name, dataType };
        if (description) property.description = description;
        if (indexFilterable !== undefined) property.indexFilterable = indexFilterable;
        if (indexSearchable !== undefined) property.indexSearchable = indexSearchable;
        if (tokenization) property.tokenization = tokenization;

        await client.addProperty(className, property as Parameters<typeof client.addProperty>[1]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Property '${name}' added to class '${className}'` },
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
