/**
 * Weaviate API Client
 *
 * This file handles all HTTP communication with the Weaviate REST API.
 *
 * MULTI-TENANT: This client receives credentials per-request via TenantCredentials,
 * allowing a single server to serve multiple tenants with different API keys.
 */

import type {
  BackupCreateRequest,
  BackupRestoreRequest,
  BackupStatus,
  BatchDeleteRequest,
  BatchDeleteResponse,
  BatchObjectsResponse,
  BatchReferencesRequest,
  BatchReferencesResponse,
  Bm25Params,
  ClassificationRequest,
  ClassificationResponse,
  ClusterStatistics,
  GraphQLResponse,
  HybridParams,
  LivenessResponse,
  NearObjectParams,
  NearTextParams,
  NearVectorParams,
  NodeStatus,
  PaginatedResponse,
  PaginationParams,
  ReadinessResponse,
  ReferencePayload,
  Tenant,
  TenantCreateRequest,
  TenantUpdateRequest,
  WeaviateClass,
  WeaviateMeta,
  WeaviateObject,
  WeaviateObjectResponse,
  WeaviateSchema,
  WhereFilter,
} from './types/entities.js';
import type { TenantCredentials } from './types/env.js';
import { AuthenticationError, WeaviateApiError, RateLimitError, NotFoundError } from './utils/errors.js';
import { createPaginatedResponse } from './utils/pagination.js';

// =============================================================================
// Weaviate Client Interface
// =============================================================================

export interface WeaviateClient {
  // Connection
  testConnection(): Promise<{ connected: boolean; message: string }>;

  // Meta / Health
  getMeta(): Promise<WeaviateMeta>;
  isLive(): Promise<LivenessResponse>;
  isReady(): Promise<ReadinessResponse>;

  // Schema
  getSchema(): Promise<WeaviateSchema>;
  getClass(className: string): Promise<WeaviateClass>;
  createClass(classConfig: WeaviateClass): Promise<WeaviateClass>;
  updateClass(className: string, updates: Partial<WeaviateClass>): Promise<WeaviateClass>;
  deleteClass(className: string): Promise<void>;
  addProperty(
    className: string,
    property: { name: string; dataType: string[]; description?: string }
  ): Promise<void>;

  // Objects
  listObjects(
    className: string,
    params?: PaginationParams & { include?: string[]; tenant?: string }
  ): Promise<PaginatedResponse<WeaviateObjectResponse>>;
  getObject(
    className: string,
    id: string,
    options?: { include?: string[]; tenant?: string }
  ): Promise<WeaviateObjectResponse>;
  createObject(object: WeaviateObject): Promise<WeaviateObjectResponse>;
  updateObject(
    className: string,
    id: string,
    properties: Record<string, unknown>,
    options?: { vector?: number[]; tenant?: string }
  ): Promise<WeaviateObjectResponse>;
  patchObject(
    className: string,
    id: string,
    properties: Record<string, unknown>,
    options?: { tenant?: string }
  ): Promise<void>;
  deleteObject(className: string, id: string, options?: { tenant?: string }): Promise<void>;
  objectExists(className: string, id: string, options?: { tenant?: string }): Promise<boolean>;

  // Batch Operations
  batchCreateObjects(objects: WeaviateObject[]): Promise<BatchObjectsResponse[]>;
  batchDeleteObjects(request: BatchDeleteRequest): Promise<BatchDeleteResponse>;
  batchAddReferences(request: BatchReferencesRequest): Promise<BatchReferencesResponse[]>;

  // References
  addReference(
    className: string,
    id: string,
    propertyName: string,
    reference: ReferencePayload,
    options?: { tenant?: string }
  ): Promise<void>;
  updateReferences(
    className: string,
    id: string,
    propertyName: string,
    references: ReferencePayload[],
    options?: { tenant?: string }
  ): Promise<void>;
  deleteReference(
    className: string,
    id: string,
    propertyName: string,
    reference: ReferencePayload,
    options?: { tenant?: string }
  ): Promise<void>;

  // Search (via GraphQL)
  graphqlQuery(query: string): Promise<GraphQLResponse>;
  nearVector(
    className: string,
    params: NearVectorParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse>;
  nearText(
    className: string,
    params: NearTextParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse>;
  nearObject(
    className: string,
    params: NearObjectParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse>;
  hybridSearch(
    className: string,
    params: HybridParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse>;
  bm25Search(
    className: string,
    params: Bm25Params,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse>;

  // Tenants
  getTenants(className: string): Promise<Tenant[]>;
  createTenants(className: string, tenants: TenantCreateRequest[]): Promise<Tenant[]>;
  updateTenants(className: string, tenants: TenantUpdateRequest[]): Promise<void>;
  deleteTenants(className: string, tenantNames: string[]): Promise<void>;
  tenantExists(className: string, tenantName: string): Promise<boolean>;

  // Backups
  createBackup(backend: string, request: BackupCreateRequest): Promise<BackupStatus>;
  getBackupStatus(backend: string, backupId: string): Promise<BackupStatus>;
  restoreBackup(backend: string, backupId: string, request?: BackupRestoreRequest): Promise<BackupStatus>;
  getRestoreStatus(backend: string, backupId: string): Promise<BackupStatus>;
  cancelBackup(backend: string, backupId: string): Promise<void>;

  // Nodes / Cluster
  getNodes(options?: { output?: string }): Promise<NodeStatus[]>;
  getClusterStatistics(): Promise<ClusterStatistics>;

  // Classification
  createClassification(request: ClassificationRequest): Promise<ClassificationResponse>;
  getClassification(id: string): Promise<ClassificationResponse>;
}

// =============================================================================
// Weaviate Client Implementation
// =============================================================================

class WeaviateClientImpl implements WeaviateClient {
  private credentials: TenantCredentials;
  private baseUrl: string;

  constructor(credentials: TenantCredentials) {
    this.credentials = credentials;
    // Remove trailing slash if present
    this.baseUrl = (credentials.weaviateUrl || '').replace(/\/$/, '');
  }

  // ===========================================================================
  // HTTP Request Helper
  // ===========================================================================

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Weaviate API Key authentication
    if (this.credentials.apiKey) {
      headers['Authorization'] = `Bearer ${this.credentials.apiKey}`;
    }

    // Vectorization module API keys
    if (this.credentials.openaiApiKey) {
      headers['X-OpenAI-Api-Key'] = this.credentials.openaiApiKey;
    }
    if (this.credentials.cohereApiKey) {
      headers['X-Cohere-Api-Key'] = this.credentials.cohereApiKey;
    }
    if (this.credentials.huggingfaceApiKey) {
      headers['X-HuggingFace-Api-Key'] = this.credentials.huggingfaceApiKey;
    }
    if (this.credentials.anthropicApiKey) {
      headers['X-Anthropic-Api-Key'] = this.credentials.anthropicApiKey;
    }
    if (this.credentials.azureApiKey) {
      headers['X-Azure-Api-Key'] = this.credentials.azureApiKey;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new AuthenticationError('No Weaviate URL provided. Include X-Weaviate-URL header.');
    }

    const url = `${this.baseUrl}/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError('Rate limit exceeded', retryAfter ? parseInt(retryAfter, 10) : 60);
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError('Authentication failed. Check your Weaviate API key.');
    }

    // Handle not found
    if (response.status === 404) {
      throw new NotFoundError('Resource', endpoint);
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.text();
      let message = `Weaviate API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.error?.message || errorJson.message || errorJson.error || message;
      } catch {
        if (errorBody) {
          message = errorBody;
        }
      }
      throw new WeaviateApiError(message, response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      const meta = await this.getMeta();
      return {
        connected: true,
        message: `Connected to Weaviate ${meta.version} at ${meta.hostname}`,
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ===========================================================================
  // Meta / Health
  // ===========================================================================

  async getMeta(): Promise<WeaviateMeta> {
    return this.request<WeaviateMeta>('/meta');
  }

  async isLive(): Promise<LivenessResponse> {
    try {
      await this.request<void>('/.well-known/live');
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  async isReady(): Promise<ReadinessResponse> {
    try {
      await this.request<void>('/.well-known/ready');
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  // ===========================================================================
  // Schema
  // ===========================================================================

  async getSchema(): Promise<WeaviateSchema> {
    return this.request<WeaviateSchema>('/schema');
  }

  async getClass(className: string): Promise<WeaviateClass> {
    return this.request<WeaviateClass>(`/schema/${encodeURIComponent(className)}`);
  }

  async createClass(classConfig: WeaviateClass): Promise<WeaviateClass> {
    return this.request<WeaviateClass>('/schema', {
      method: 'POST',
      body: JSON.stringify(classConfig),
    });
  }

  async updateClass(className: string, updates: Partial<WeaviateClass>): Promise<WeaviateClass> {
    return this.request<WeaviateClass>(`/schema/${encodeURIComponent(className)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClass(className: string): Promise<void> {
    await this.request<void>(`/schema/${encodeURIComponent(className)}`, {
      method: 'DELETE',
    });
  }

  async addProperty(
    className: string,
    property: { name: string; dataType: string[]; description?: string }
  ): Promise<void> {
    await this.request<void>(`/schema/${encodeURIComponent(className)}/properties`, {
      method: 'POST',
      body: JSON.stringify(property),
    });
  }

  // ===========================================================================
  // Objects
  // ===========================================================================

  async listObjects(
    className: string,
    params?: PaginationParams & { include?: string[]; tenant?: string }
  ): Promise<PaginatedResponse<WeaviateObjectResponse>> {
    const queryParams = new URLSearchParams();
    queryParams.set('class', className);
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));
    if (params?.include) queryParams.set('include', params.include.join(','));
    if (params?.tenant) queryParams.set('tenant', params.tenant);

    const response = await this.request<{
      objects: WeaviateObjectResponse[];
      totalResults?: number;
    }>(`/objects?${queryParams.toString()}`);

    const limit = params?.limit || 20;
    const offset = params?.offset || 0;
    const hasMore = response.objects.length === limit;
    const nextOffset = hasMore ? offset + limit : undefined;

    return createPaginatedResponse(response.objects, {
      total: response.totalResults,
      hasMore,
      nextCursor: nextOffset !== undefined ? String(nextOffset) : undefined,
    });
  }

  async getObject(
    className: string,
    id: string,
    options?: { include?: string[]; tenant?: string }
  ): Promise<WeaviateObjectResponse> {
    const queryParams = new URLSearchParams();
    if (options?.include) queryParams.set('include', options.include.join(','));
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    return this.request<WeaviateObjectResponse>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`
    );
  }

  async createObject(object: WeaviateObject): Promise<WeaviateObjectResponse> {
    return this.request<WeaviateObjectResponse>('/objects', {
      method: 'POST',
      body: JSON.stringify(object),
    });
  }

  async updateObject(
    className: string,
    id: string,
    properties: Record<string, unknown>,
    options?: { vector?: number[]; tenant?: string }
  ): Promise<WeaviateObjectResponse> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    const body: Record<string, unknown> = {
      class: className,
      properties,
    };
    if (options?.vector) body.vector = options.vector;

    return this.request<WeaviateObjectResponse>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  async patchObject(
    className: string,
    id: string,
    properties: Record<string, unknown>,
    options?: { tenant?: string }
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    await this.request<void>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ class: className, properties }),
      }
    );
  }

  async deleteObject(className: string, id: string, options?: { tenant?: string }): Promise<void> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    await this.request<void>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`,
      {
        method: 'DELETE',
      }
    );
  }

  async objectExists(
    className: string,
    id: string,
    options?: { tenant?: string }
  ): Promise<boolean> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    try {
      const url = `${this.baseUrl}/v1/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.getAuthHeaders(),
      });
      return response.status === 204 || response.status === 200;
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Batch Operations
  // ===========================================================================

  async batchCreateObjects(objects: WeaviateObject[]): Promise<BatchObjectsResponse[]> {
    return this.request<BatchObjectsResponse[]>('/batch/objects', {
      method: 'POST',
      body: JSON.stringify({ objects }),
    });
  }

  async batchDeleteObjects(request: BatchDeleteRequest): Promise<BatchDeleteResponse> {
    return this.request<BatchDeleteResponse>('/batch/objects', {
      method: 'DELETE',
      body: JSON.stringify(request),
    });
  }

  async batchAddReferences(request: BatchReferencesRequest): Promise<BatchReferencesResponse[]> {
    return this.request<BatchReferencesResponse[]>('/batch/references', {
      method: 'POST',
      body: JSON.stringify(request.references),
    });
  }

  // ===========================================================================
  // References
  // ===========================================================================

  async addReference(
    className: string,
    id: string,
    propertyName: string,
    reference: ReferencePayload,
    options?: { tenant?: string }
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    await this.request<void>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}/references/${encodeURIComponent(propertyName)}${query ? `?${query}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify(reference),
      }
    );
  }

  async updateReferences(
    className: string,
    id: string,
    propertyName: string,
    references: ReferencePayload[],
    options?: { tenant?: string }
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    await this.request<void>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}/references/${encodeURIComponent(propertyName)}${query ? `?${query}` : ''}`,
      {
        method: 'PUT',
        body: JSON.stringify(references),
      }
    );
  }

  async deleteReference(
    className: string,
    id: string,
    propertyName: string,
    reference: ReferencePayload,
    options?: { tenant?: string }
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    if (options?.tenant) queryParams.set('tenant', options.tenant);

    const query = queryParams.toString();
    await this.request<void>(
      `/objects/${encodeURIComponent(className)}/${encodeURIComponent(id)}/references/${encodeURIComponent(propertyName)}${query ? `?${query}` : ''}`,
      {
        method: 'DELETE',
        body: JSON.stringify(reference),
      }
    );
  }

  // ===========================================================================
  // Search (via GraphQL)
  // ===========================================================================

  async graphqlQuery(query: string): Promise<GraphQLResponse> {
    return this.request<GraphQLResponse>('/graphql', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  private buildGraphQLGetQuery(
    className: string,
    searchClause: string,
    options?: {
      limit?: number;
      fields?: string[];
      where?: WhereFilter;
      tenant?: string;
    }
  ): string {
    const fields = options?.fields?.length ? options.fields.join(' ') : '_additional { id distance certainty }';
    const limit = options?.limit || 10;

    let whereClause = '';
    if (options?.where) {
      whereClause = `, where: ${JSON.stringify(options.where)}`;
    }

    let tenantClause = '';
    if (options?.tenant) {
      tenantClause = `, tenant: "${options.tenant}"`;
    }

    return `{
      Get {
        ${className}(
          ${searchClause}
          limit: ${limit}
          ${whereClause}
          ${tenantClause}
        ) {
          ${fields}
        }
      }
    }`;
  }

  async nearVector(
    className: string,
    params: NearVectorParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse> {
    let nearVectorClause = `nearVector: { vector: [${params.vector.join(', ')}]`;
    if (params.certainty !== undefined) nearVectorClause += `, certainty: ${params.certainty}`;
    if (params.distance !== undefined) nearVectorClause += `, distance: ${params.distance}`;
    nearVectorClause += ' }';

    const query = this.buildGraphQLGetQuery(className, nearVectorClause, options);
    return this.graphqlQuery(query);
  }

  async nearText(
    className: string,
    params: NearTextParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse> {
    let nearTextClause = `nearText: { concepts: ${JSON.stringify(params.concepts)}`;
    if (params.certainty !== undefined) nearTextClause += `, certainty: ${params.certainty}`;
    if (params.distance !== undefined) nearTextClause += `, distance: ${params.distance}`;
    if (params.moveTo) {
      nearTextClause += `, moveTo: { force: ${params.moveTo.force}`;
      if (params.moveTo.concepts) nearTextClause += `, concepts: ${JSON.stringify(params.moveTo.concepts)}`;
      if (params.moveTo.objects) nearTextClause += `, objects: ${JSON.stringify(params.moveTo.objects)}`;
      nearTextClause += ' }';
    }
    if (params.moveAwayFrom) {
      nearTextClause += `, moveAwayFrom: { force: ${params.moveAwayFrom.force}`;
      if (params.moveAwayFrom.concepts) nearTextClause += `, concepts: ${JSON.stringify(params.moveAwayFrom.concepts)}`;
      if (params.moveAwayFrom.objects) nearTextClause += `, objects: ${JSON.stringify(params.moveAwayFrom.objects)}`;
      nearTextClause += ' }';
    }
    nearTextClause += ' }';

    const query = this.buildGraphQLGetQuery(className, nearTextClause, options);
    return this.graphqlQuery(query);
  }

  async nearObject(
    className: string,
    params: NearObjectParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse> {
    let nearObjectClause = `nearObject: { id: "${params.id}"`;
    if (params.certainty !== undefined) nearObjectClause += `, certainty: ${params.certainty}`;
    if (params.distance !== undefined) nearObjectClause += `, distance: ${params.distance}`;
    nearObjectClause += ' }';

    const query = this.buildGraphQLGetQuery(className, nearObjectClause, options);
    return this.graphqlQuery(query);
  }

  async hybridSearch(
    className: string,
    params: HybridParams,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse> {
    let hybridClause = `hybrid: { query: "${params.query}"`;
    if (params.alpha !== undefined) hybridClause += `, alpha: ${params.alpha}`;
    if (params.vector) hybridClause += `, vector: [${params.vector.join(', ')}]`;
    if (params.properties) hybridClause += `, properties: ${JSON.stringify(params.properties)}`;
    if (params.fusionType) hybridClause += `, fusionType: ${params.fusionType}`;
    hybridClause += ' }';

    const query = this.buildGraphQLGetQuery(className, hybridClause, options);
    return this.graphqlQuery(query);
  }

  async bm25Search(
    className: string,
    params: Bm25Params,
    options?: { limit?: number; fields?: string[]; where?: WhereFilter; tenant?: string }
  ): Promise<GraphQLResponse> {
    let bm25Clause = `bm25: { query: "${params.query}"`;
    if (params.properties) bm25Clause += `, properties: ${JSON.stringify(params.properties)}`;
    bm25Clause += ' }';

    const query = this.buildGraphQLGetQuery(className, bm25Clause, options);
    return this.graphqlQuery(query);
  }

  // ===========================================================================
  // Tenants
  // ===========================================================================

  async getTenants(className: string): Promise<Tenant[]> {
    return this.request<Tenant[]>(`/schema/${encodeURIComponent(className)}/tenants`);
  }

  async createTenants(className: string, tenants: TenantCreateRequest[]): Promise<Tenant[]> {
    return this.request<Tenant[]>(`/schema/${encodeURIComponent(className)}/tenants`, {
      method: 'POST',
      body: JSON.stringify(tenants),
    });
  }

  async updateTenants(className: string, tenants: TenantUpdateRequest[]): Promise<void> {
    await this.request<void>(`/schema/${encodeURIComponent(className)}/tenants`, {
      method: 'PUT',
      body: JSON.stringify(tenants),
    });
  }

  async deleteTenants(className: string, tenantNames: string[]): Promise<void> {
    await this.request<void>(`/schema/${encodeURIComponent(className)}/tenants`, {
      method: 'DELETE',
      body: JSON.stringify(tenantNames),
    });
  }

  async tenantExists(className: string, tenantName: string): Promise<boolean> {
    try {
      const tenants = await this.getTenants(className);
      return tenants.some((t) => t.name === tenantName);
    } catch {
      return false;
    }
  }

  // ===========================================================================
  // Backups
  // ===========================================================================

  async createBackup(backend: string, request: BackupCreateRequest): Promise<BackupStatus> {
    return this.request<BackupStatus>(`/backups/${encodeURIComponent(backend)}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getBackupStatus(backend: string, backupId: string): Promise<BackupStatus> {
    return this.request<BackupStatus>(
      `/backups/${encodeURIComponent(backend)}/${encodeURIComponent(backupId)}`
    );
  }

  async restoreBackup(
    backend: string,
    backupId: string,
    request?: BackupRestoreRequest
  ): Promise<BackupStatus> {
    return this.request<BackupStatus>(
      `/backups/${encodeURIComponent(backend)}/${encodeURIComponent(backupId)}/restore`,
      {
        method: 'POST',
        body: request ? JSON.stringify(request) : undefined,
      }
    );
  }

  async getRestoreStatus(backend: string, backupId: string): Promise<BackupStatus> {
    return this.request<BackupStatus>(
      `/backups/${encodeURIComponent(backend)}/${encodeURIComponent(backupId)}/restore`
    );
  }

  async cancelBackup(backend: string, backupId: string): Promise<void> {
    await this.request<void>(
      `/backups/${encodeURIComponent(backend)}/${encodeURIComponent(backupId)}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ===========================================================================
  // Nodes / Cluster
  // ===========================================================================

  async getNodes(options?: { output?: string }): Promise<NodeStatus[]> {
    const queryParams = new URLSearchParams();
    if (options?.output) queryParams.set('output', options.output);

    const query = queryParams.toString();
    const response = await this.request<{ nodes: NodeStatus[] }>(`/nodes${query ? `?${query}` : ''}`);
    return response.nodes;
  }

  async getClusterStatistics(): Promise<ClusterStatistics> {
    return this.request<ClusterStatistics>('/cluster/statistics');
  }

  // ===========================================================================
  // Classification
  // ===========================================================================

  async createClassification(request: ClassificationRequest): Promise<ClassificationResponse> {
    return this.request<ClassificationResponse>('/classifications', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getClassification(id: string): Promise<ClassificationResponse> {
    return this.request<ClassificationResponse>(`/classifications/${encodeURIComponent(id)}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Weaviate client instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides its own credentials via headers,
 * allowing a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
export function createWeaviateClient(credentials: TenantCredentials): WeaviateClient {
  return new WeaviateClientImpl(credentials);
}
