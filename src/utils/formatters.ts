/**
 * Response Formatting Utilities
 *
 * Helpers for formatting tool responses in JSON or Markdown.
 */

import type {
  PaginatedResponse,
  ResponseFormat,
  WeaviateClass,
  WeaviateObject,
  NodeStatus,
  BackupStatus,
  Tenant,
} from '../types/entities.js';
import { WeaviateApiError, formatErrorForLogging } from './errors.js';

/**
 * MCP tool response type
 * Note: Index signature required for MCP SDK 1.25+ compatibility
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Format a successful response
 */
export function formatResponse(
  data: unknown,
  format: ResponseFormat,
  entityType: string
): ToolResponse {
  if (format === 'markdown') {
    return {
      content: [{ type: 'text', text: formatAsMarkdown(data, entityType) }],
    };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Format an error response
 */
export function formatError(error: unknown): ToolResponse {
  const errorInfo = formatErrorForLogging(error);

  let message: string;
  if (error instanceof WeaviateApiError) {
    message = `Error: ${error.message}`;
    if (error.retryable) {
      message += ' (retryable)';
    }
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Error: ${String(error)}`;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message, details: errorInfo }, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Format data as Markdown
 */
function formatAsMarkdown(data: unknown, entityType: string): string {
  if (isPaginatedResponse(data)) {
    return formatPaginatedAsMarkdown(data, entityType);
  }

  if (Array.isArray(data)) {
    return formatArrayAsMarkdown(data, entityType);
  }

  if (typeof data === 'object' && data !== null) {
    return formatObjectAsMarkdown(data as Record<string, unknown>, entityType);
  }

  return String(data);
}

/**
 * Type guard for paginated response
 */
function isPaginatedResponse(data: unknown): data is PaginatedResponse<unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    Array.isArray((data as PaginatedResponse<unknown>).items)
  );
}

/**
 * Format paginated response as Markdown
 */
function formatPaginatedAsMarkdown(data: PaginatedResponse<unknown>, entityType: string): string {
  const lines: string[] = [];

  lines.push(`## ${capitalize(entityType)}`);
  lines.push('');

  if (data.total !== undefined) {
    lines.push(`**Total:** ${data.total} | **Showing:** ${data.count}`);
  } else {
    lines.push(`**Showing:** ${data.count}`);
  }

  if (data.hasMore) {
    lines.push(`**More available:** Yes (cursor: \`${data.nextCursor}\`)`);
  }
  lines.push('');

  if (data.items.length === 0) {
    lines.push('_No items found._');
    return lines.join('\n');
  }

  // Format items based on entity type
  switch (entityType) {
    case 'classes':
    case 'collections':
      lines.push(formatClassesTable(data.items as WeaviateClass[]));
      break;
    case 'objects':
      lines.push(formatObjectsTable(data.items as WeaviateObject[]));
      break;
    case 'nodes':
      lines.push(formatNodesTable(data.items as NodeStatus[]));
      break;
    case 'backups':
      lines.push(formatBackupsTable(data.items as BackupStatus[]));
      break;
    case 'tenants':
      lines.push(formatTenantsTable(data.items as Tenant[]));
      break;
    default:
      lines.push(formatGenericTable(data.items));
  }

  return lines.join('\n');
}

/**
 * Format classes as Markdown table
 */
function formatClassesTable(classes: WeaviateClass[]): string {
  const lines: string[] = [];
  lines.push('| Class | Description | Vectorizer | Properties |');
  lines.push('|---|---|---|---|');

  for (const cls of classes) {
    const propCount = cls.properties?.length || 0;
    lines.push(
      `| ${cls.class} | ${cls.description || '-'} | ${cls.vectorizer || 'none'} | ${propCount} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format objects as Markdown table
 */
function formatObjectsTable(objects: WeaviateObject[]): string {
  const lines: string[] = [];
  lines.push('| ID | Class | Properties |');
  lines.push('|---|---|---|');

  for (const obj of objects) {
    const propKeys = Object.keys(obj.properties || {}).slice(0, 3);
    const propsPreview = propKeys.length > 0 ? propKeys.join(', ') + '...' : '-';
    lines.push(`| ${obj.id || '-'} | ${obj.class} | ${propsPreview} |`);
  }

  return lines.join('\n');
}

/**
 * Format nodes as Markdown table
 */
function formatNodesTable(nodes: NodeStatus[]): string {
  const lines: string[] = [];
  lines.push('| Name | Status | Version | Objects | Shards |');
  lines.push('|---|---|---|---|---|');

  for (const node of nodes) {
    lines.push(
      `| ${node.name} | ${node.status} | ${node.version} | ${node.stats.objectCount} | ${node.stats.shardCount} |`
    );
  }

  return lines.join('\n');
}

/**
 * Format backups as Markdown table
 */
function formatBackupsTable(backups: BackupStatus[]): string {
  const lines: string[] = [];
  lines.push('| ID | Backend | Status | Path |');
  lines.push('|---|---|---|---|');

  for (const backup of backups) {
    lines.push(`| ${backup.id} | ${backup.backend} | ${backup.status} | ${backup.path || '-'} |`);
  }

  return lines.join('\n');
}

/**
 * Format tenants as Markdown table
 */
function formatTenantsTable(tenants: Tenant[]): string {
  const lines: string[] = [];
  lines.push('| Name | Activity Status |');
  lines.push('|---|---|');

  for (const tenant of tenants) {
    lines.push(`| ${tenant.name} | ${tenant.activityStatus || 'ACTIVE'} |`);
  }

  return lines.join('\n');
}

/**
 * Format a generic array as Markdown table
 */
function formatGenericTable(items: unknown[]): string {
  if (items.length === 0) return '_No items_';

  const first = items[0] as Record<string, unknown>;
  const keys = Object.keys(first).slice(0, 5); // Limit columns

  const lines: string[] = [];
  lines.push(`| ${keys.join(' | ')} |`);
  lines.push(`|${keys.map(() => '---').join('|')}|`);

  for (const item of items) {
    const record = item as Record<string, unknown>;
    const values = keys.map((k) => String(record[k] ?? '-'));
    lines.push(`| ${values.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Format an array as Markdown
 */
function formatArrayAsMarkdown(data: unknown[], entityType: string): string {
  switch (entityType) {
    case 'classes':
    case 'collections':
      return formatClassesTable(data as WeaviateClass[]);
    case 'nodes':
      return formatNodesTable(data as NodeStatus[]);
    case 'tenants':
      return formatTenantsTable(data as Tenant[]);
    default:
      return formatGenericTable(data);
  }
}

/**
 * Format a single object as Markdown
 */
function formatObjectAsMarkdown(data: Record<string, unknown>, entityType: string): string {
  const lines: string[] = [];
  lines.push(`## ${capitalize(entityType.replace(/s$/, ''))}`);
  lines.push('');

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object') {
      lines.push(`**${formatKey(key)}:**`);
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
    } else {
      lines.push(`**${formatKey(key)}:** ${value}`);
    }
  }

  return lines.join('\n');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a key for display (camelCase to Title Case)
 */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
