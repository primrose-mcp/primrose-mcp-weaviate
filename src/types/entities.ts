/**
 * Weaviate Entity Types
 *
 * Type definitions for Weaviate API entities and operations.
 */

// =============================================================================
// Pagination
// =============================================================================

export interface PaginationParams {
  /** Number of items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Number of items in this response */
  count: number;
  /** Total count (if available) */
  total?: number;
  /** Whether more items are available */
  hasMore: boolean;
  /** Cursor for next page */
  nextCursor?: string;
}

// =============================================================================
// Response Format
// =============================================================================

export type ResponseFormat = 'json' | 'markdown';

// =============================================================================
// Schema / Collection Types
// =============================================================================

export interface WeaviateClass {
  class: string;
  description?: string;
  vectorizer?: string;
  moduleConfig?: Record<string, unknown>;
  properties?: WeaviateProperty[];
  invertedIndexConfig?: InvertedIndexConfig;
  vectorIndexConfig?: VectorIndexConfig;
  vectorIndexType?: string;
  shardingConfig?: ShardingConfig;
  replicationConfig?: ReplicationConfig;
  multiTenancyConfig?: MultiTenancyConfig;
}

export interface WeaviateProperty {
  name: string;
  dataType: string[];
  description?: string;
  indexFilterable?: boolean;
  indexSearchable?: boolean;
  indexInverted?: boolean;
  tokenization?: string;
  moduleConfig?: Record<string, unknown>;
}

export interface InvertedIndexConfig {
  bm25?: {
    b?: number;
    k1?: number;
  };
  cleanupIntervalSeconds?: number;
  stopwords?: {
    preset?: string;
    additions?: string[];
    removals?: string[];
  };
}

export interface VectorIndexConfig {
  distance?: string;
  ef?: number;
  efConstruction?: number;
  maxConnections?: number;
  dynamicEfMin?: number;
  dynamicEfMax?: number;
  dynamicEfFactor?: number;
  flatSearchCutoff?: number;
  skip?: boolean;
  vectorCacheMaxObjects?: number;
  pq?: {
    enabled?: boolean;
    segments?: number;
    centroids?: number;
    trainingLimit?: number;
    encoder?: {
      type?: string;
      distribution?: string;
    };
  };
}

export interface ShardingConfig {
  virtualPerPhysical?: number;
  desiredCount?: number;
  actualCount?: number;
  desiredVirtualCount?: number;
  actualVirtualCount?: number;
  key?: string;
  strategy?: string;
  function?: string;
}

export interface ReplicationConfig {
  factor?: number;
  asyncEnabled?: boolean;
}

export interface MultiTenancyConfig {
  enabled?: boolean;
  autoTenantCreation?: boolean;
  autoTenantActivation?: boolean;
}

export interface WeaviateSchema {
  classes: WeaviateClass[];
}

// =============================================================================
// Object Types
// =============================================================================

export interface WeaviateObject {
  id?: string;
  class: string;
  properties: Record<string, unknown>;
  vector?: number[];
  tenant?: string;
  creationTimeUnix?: number;
  lastUpdateTimeUnix?: number;
}

export interface WeaviateObjectResponse extends WeaviateObject {
  id: string;
  additional?: {
    id?: string;
    vector?: number[];
    creationTimeUnix?: number;
    lastUpdateTimeUnix?: number;
    distance?: number;
    certainty?: number;
    score?: number;
    explainScore?: string;
  };
}

export interface BatchObjectsRequest {
  objects: WeaviateObject[];
}

export interface BatchObjectsResponse {
  id: string;
  result?: {
    status?: string;
    errors?: {
      error?: Array<{
        message: string;
      }>;
    };
  };
}

export interface BatchDeleteRequest {
  match: {
    class: string;
    where: WhereFilter;
  };
  output?: 'minimal' | 'verbose';
  dryRun?: boolean;
}

export interface BatchDeleteResponse {
  match: {
    class: string;
    where: WhereFilter;
  };
  output: string;
  dryRun: boolean;
  results: {
    matches: number;
    limit: number;
    successful: number;
    failed: number;
    objects?: Array<{
      id: string;
      status: string;
      errors?: Array<{ message: string }>;
    }>;
  };
}

// =============================================================================
// Search / Query Types
// =============================================================================

export interface WhereFilter {
  operator:
    | 'And'
    | 'Or'
    | 'Equal'
    | 'NotEqual'
    | 'GreaterThan'
    | 'GreaterThanEqual'
    | 'LessThan'
    | 'LessThanEqual'
    | 'Like'
    | 'WithinGeoRange'
    | 'IsNull'
    | 'ContainsAny'
    | 'ContainsAll';
  operands?: WhereFilter[];
  path?: string[];
  valueInt?: number;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueString?: string;
  valueText?: string;
  valueDate?: string;
  valueGeoRange?: {
    geoCoordinates: {
      latitude: number;
      longitude: number;
    };
    distance: {
      max: number;
    };
  };
  valueIntArray?: number[];
  valueNumberArray?: number[];
  valueBooleanArray?: boolean[];
  valueStringArray?: string[];
  valueTextArray?: string[];
  valueDateArray?: string[];
}

export interface NearVectorParams {
  vector: number[];
  certainty?: number;
  distance?: number;
}

export interface NearTextParams {
  concepts: string[];
  certainty?: number;
  distance?: number;
  moveTo?: {
    concepts?: string[];
    objects?: Array<{ id: string }>;
    force: number;
  };
  moveAwayFrom?: {
    concepts?: string[];
    objects?: Array<{ id: string }>;
    force: number;
  };
}

export interface NearObjectParams {
  id: string;
  certainty?: number;
  distance?: number;
}

export interface HybridParams {
  query: string;
  alpha?: number;
  vector?: number[];
  properties?: string[];
  fusionType?: 'rankedFusion' | 'relativeScoreFusion';
}

export interface Bm25Params {
  query: string;
  properties?: string[];
}

export interface GraphQLResponse {
  data?: {
    Get?: Record<string, unknown[]>;
    Aggregate?: Record<string, unknown>;
    Explore?: unknown[];
  };
  errors?: Array<{
    message: string;
    path?: string[];
    locations?: Array<{ line: number; column: number }>;
  }>;
}

// =============================================================================
// Backup Types
// =============================================================================

export interface BackupCreateRequest {
  id: string;
  include?: string[];
  exclude?: string[];
}

export interface BackupRestoreRequest {
  include?: string[];
  exclude?: string[];
}

export interface BackupStatus {
  id: string;
  backend: string;
  path: string;
  status: 'STARTED' | 'TRANSFERRING' | 'TRANSFERRED' | 'SUCCESS' | 'FAILED' | 'CANCELED';
  error?: string;
}

// =============================================================================
// Tenant Types
// =============================================================================

export interface Tenant {
  name: string;
  activityStatus?: 'HOT' | 'COLD' | 'FROZEN' | 'ACTIVE' | 'INACTIVE' | 'OFFLOADED';
}

export interface TenantCreateRequest {
  name: string;
  activityStatus?: 'HOT' | 'COLD' | 'ACTIVE' | 'INACTIVE';
}

export interface TenantUpdateRequest {
  name: string;
  activityStatus: 'HOT' | 'COLD' | 'FROZEN' | 'ACTIVE' | 'INACTIVE' | 'OFFLOADED';
}

// =============================================================================
// Node / Cluster Types
// =============================================================================

export interface NodeStatus {
  name: string;
  status: 'HEALTHY' | 'UNHEALTHY' | 'UNAVAILABLE';
  version: string;
  gitHash: string;
  stats: {
    shardCount: number;
    objectCount: number;
  };
  shards?: ShardStatus[];
}

export interface ShardStatus {
  name: string;
  class: string;
  objectCount: number;
  vectorIndexingStatus: string;
  vectorQueueLength: number;
  compressed: boolean;
  loaded: boolean;
}

export interface ClusterStatistics {
  id: string;
  status: string;
  statistics?: unknown;
}

// =============================================================================
// Meta / Health Types
// =============================================================================

export interface WeaviateMeta {
  hostname: string;
  version: string;
  modules: Record<string, unknown>;
}

export interface LivenessResponse {
  status: 'ok' | 'error';
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
}

// =============================================================================
// Classification Types
// =============================================================================

export interface ClassificationRequest {
  type: 'knn' | 'text2vec-contextionary-contextual' | 'zeroshot';
  class: string;
  classifyProperties: string[];
  basedOnProperties: string[];
  settings?: {
    k?: number;
  };
  filters?: {
    sourceWhere?: WhereFilter;
    targetWhere?: WhereFilter;
    trainingSetWhere?: WhereFilter;
  };
}

export interface ClassificationResponse {
  id: string;
  class: string;
  classifyProperties: string[];
  basedOnProperties: string[];
  status: 'running' | 'completed' | 'failed';
  meta?: {
    started?: string;
    completed?: string;
    count?: number;
    countSucceeded?: number;
    countFailed?: number;
  };
  type: string;
  settings?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  error?: string;
}

// =============================================================================
// References Types
// =============================================================================

export interface ReferencePayload {
  beacon: string;
}

export interface BatchReferencesRequest {
  references: Array<{
    from: string;
    to: string;
  }>;
}

export interface BatchReferencesResponse {
  result?: {
    status?: string;
    errors?: {
      error?: Array<{
        message: string;
      }>;
    };
  };
}
