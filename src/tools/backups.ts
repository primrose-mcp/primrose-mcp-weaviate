/**
 * Backup Tools
 *
 * MCP tools for Weaviate backup and restore operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WeaviateClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all backup-related tools
 */
export function registerBackupTools(server: McpServer, client: WeaviateClient): void {
  // ===========================================================================
  // Create Backup
  // ===========================================================================
  server.tool(
    'weaviate_create_backup',
    `Create a backup of Weaviate data.

Backups can be stored in different backends (filesystem, s3, gcs, azure).

Args:
  - backend: Backup backend (filesystem, s3, gcs, azure)
  - backupId: Unique identifier for this backup
  - include: Array of class names to include (optional, default: all)
  - exclude: Array of class names to exclude (optional)

Returns the backup status.`,
    {
      backend: z.enum(['filesystem', 's3', 'gcs', 'azure']).describe('Backup storage backend'),
      backupId: z.string().describe('Unique backup identifier'),
      include: z.array(z.string()).optional().describe('Classes to include'),
      exclude: z.array(z.string()).optional().describe('Classes to exclude'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ backend, backupId, include, exclude, format }) => {
      try {
        const result = await client.createBackup(backend, {
          id: backupId,
          include,
          exclude,
        });
        return formatResponse(result, format, 'backup');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Backup Status
  // ===========================================================================
  server.tool(
    'weaviate_get_backup_status',
    `Get the status of a backup operation.

Args:
  - backend: Backup backend (filesystem, s3, gcs, azure)
  - backupId: Backup identifier

Returns the current backup status.`,
    {
      backend: z.enum(['filesystem', 's3', 'gcs', 'azure']).describe('Backup storage backend'),
      backupId: z.string().describe('Backup identifier'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ backend, backupId, format }) => {
      try {
        const result = await client.getBackupStatus(backend, backupId);
        return formatResponse(result, format, 'backup');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Restore Backup
  // ===========================================================================
  server.tool(
    'weaviate_restore_backup',
    `Restore data from a backup.

Args:
  - backend: Backup backend (filesystem, s3, gcs, azure)
  - backupId: Backup identifier to restore from
  - include: Array of class names to include in restore (optional, default: all)
  - exclude: Array of class names to exclude from restore (optional)

Returns the restore operation status.`,
    {
      backend: z.enum(['filesystem', 's3', 'gcs', 'azure']).describe('Backup storage backend'),
      backupId: z.string().describe('Backup identifier'),
      include: z.array(z.string()).optional().describe('Classes to include in restore'),
      exclude: z.array(z.string()).optional().describe('Classes to exclude from restore'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ backend, backupId, include, exclude, format }) => {
      try {
        const request = include || exclude ? { include, exclude } : undefined;
        const result = await client.restoreBackup(backend, backupId, request);
        return formatResponse(result, format, 'restore');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Get Restore Status
  // ===========================================================================
  server.tool(
    'weaviate_get_restore_status',
    `Get the status of a restore operation.

Args:
  - backend: Backup backend (filesystem, s3, gcs, azure)
  - backupId: Backup identifier

Returns the current restore status.`,
    {
      backend: z.enum(['filesystem', 's3', 'gcs', 'azure']).describe('Backup storage backend'),
      backupId: z.string().describe('Backup identifier'),
      format: z.enum(['json', 'markdown']).default('json'),
    },
    async ({ backend, backupId, format }) => {
      try {
        const result = await client.getRestoreStatus(backend, backupId);
        return formatResponse(result, format, 'restore');
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Cancel Backup
  // ===========================================================================
  server.tool(
    'weaviate_cancel_backup',
    `Cancel an in-progress backup or restore operation.

Args:
  - backend: Backup backend (filesystem, s3, gcs, azure)
  - backupId: Backup identifier to cancel

Returns confirmation of cancellation.`,
    {
      backend: z.enum(['filesystem', 's3', 'gcs', 'azure']).describe('Backup storage backend'),
      backupId: z.string().describe('Backup identifier'),
    },
    async ({ backend, backupId }) => {
      try {
        await client.cancelBackup(backend, backupId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Backup/restore operation '${backupId}' cancelled`,
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
