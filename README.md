# Weaviate MCP Server

[![Primrose MCP](https://img.shields.io/badge/Primrose-MCP-blue)](https://primrose.dev/mcp/weaviate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for Weaviate, enabling AI assistants to manage vector databases, perform semantic searches, and handle AI-native data operations.

## Features

- **Schema** - Define and manage collection schemas and properties
- **Objects** - Create, read, update, and delete data objects
- **Batch** - Efficient bulk import and export operations
- **Search** - Vector, keyword, and hybrid search queries
- **References** - Manage cross-references between objects
- **Tenants** - Multi-tenancy management
- **Backups** - Create and restore database backups
- **Cluster** - Monitor cluster health and nodes
- **Classification** - Automated data classification

## Quick Start

### Recommended: Use Primrose SDK

The easiest way to use this MCP server is with the Primrose SDK:

```bash
npm install primrose-mcp
```

```typescript
import { PrimroseMCP } from 'primrose-mcp';

const primrose = new PrimroseMCP({
  apiKey: process.env.PRIMROSE_API_KEY,
});

const weaviateClient = primrose.getClient('weaviate', {
  url: process.env.WEAVIATE_URL,
  apiKey: process.env.WEAVIATE_API_KEY,
});
```

## Manual Installation

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Weaviate instance (cloud or self-hosted)

### Setup

1. Clone and install dependencies:

```bash
git clone <repository-url>
cd primrose-mcp-weaviate
npm install
```

2. Deploy to Cloudflare Workers:

```bash
npx wrangler deploy
```

## Configuration

### Required Headers

| Header | Description |
|--------|-------------|
| `X-Weaviate-URL` | Weaviate instance URL (e.g., https://your-cluster.weaviate.network) |
| `X-Weaviate-API-Key` | Weaviate API key for authentication |

### Optional Headers

| Header | Description |
|--------|-------------|
| `X-OpenAI-Api-Key` | OpenAI API key for text2vec-openai vectorizer |
| `X-Cohere-Api-Key` | Cohere API key for text2vec-cohere vectorizer |
| `X-HuggingFace-Api-Key` | HuggingFace API key for text2vec-huggingface vectorizer |

### Example Request

```bash
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "X-Weaviate-URL: https://your-cluster.weaviate.network" \
  -H "X-Weaviate-API-Key: your-api-key" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Available Tools

### Schema Tools
- `weaviate_get_schema` - Get the full schema
- `weaviate_create_class` - Create a new class/collection
- `weaviate_update_class` - Update class configuration
- `weaviate_delete_class` - Delete a class
- `weaviate_add_property` - Add property to a class

### Object Tools
- `weaviate_create_object` - Create a data object
- `weaviate_get_object` - Get object by ID
- `weaviate_update_object` - Update an object
- `weaviate_delete_object` - Delete an object
- `weaviate_validate_object` - Validate object against schema

### Batch Tools
- `weaviate_batch_create` - Batch create objects
- `weaviate_batch_delete` - Batch delete objects
- `weaviate_batch_references` - Batch add references

### Search Tools
- `weaviate_vector_search` - Semantic/vector search
- `weaviate_keyword_search` - BM25 keyword search
- `weaviate_hybrid_search` - Combined vector and keyword search
- `weaviate_aggregate` - Aggregate data queries
- `weaviate_explore` - Explore concepts in vector space

### Reference Tools
- `weaviate_add_reference` - Add cross-reference
- `weaviate_update_references` - Update references
- `weaviate_delete_reference` - Delete a reference

### Tenant Tools
- `weaviate_list_tenants` - List tenants for a class
- `weaviate_add_tenants` - Add tenants to a class
- `weaviate_update_tenants` - Update tenant status
- `weaviate_delete_tenants` - Delete tenants

### Backup Tools
- `weaviate_create_backup` - Create a backup
- `weaviate_restore_backup` - Restore from backup
- `weaviate_get_backup_status` - Check backup status
- `weaviate_list_backups` - List available backups

### Cluster Tools
- `weaviate_get_cluster_status` - Get cluster health
- `weaviate_list_nodes` - List cluster nodes
- `weaviate_get_meta` - Get Weaviate metadata

### Classification Tools
- `weaviate_start_classification` - Start classification
- `weaviate_get_classification` - Get classification status

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Type check
npm run typecheck

# Deploy
npm run deploy
```

## Related Resources

- [Primrose SDK Documentation](https://primrose.dev/docs)
- [Weaviate Documentation](https://weaviate.io/developers/weaviate)
- [Weaviate Console](https://console.weaviate.cloud)
- [Model Context Protocol](https://modelcontextprotocol.io)
