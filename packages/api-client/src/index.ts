import type {
  AdminListingsQuery,
  AdminUsersQuery,
  ApiErrorBody,
  AttributeCreateInput,
  AttributeUpdateInput,
  AuthResponse,
  BrandDto,
  CategoryCreateInput,
  CategoryDetailDto,
  CategoryNodeDto,
  CategoryUpdateInput,
  ImageOrderInput,
  ListingCardDto,
  ListingCloseInput,
  ListingCreateInput,
  ListingDetailDto,
  ListingImageDto,
  ListingStatus,
  ListingUpdateInput,
  LoginInput,
  MeDto,
  Paginated,
  ProductModelDto,
  PublicUserDto,
  RegisterInput,
  UpdateProfileInput,
  UserRole,
  UserStatus,
} from '@kleps/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ApiErrorBody['issues'] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First issue message for a field path, e.g. fieldError('title'). */
  fieldError(field: string): string | undefined {
    return this.issues?.find((i) => i.path[0] === field)?.message;
  }
}

export type QueryValue = string | number | boolean | undefined | null;
export type Query = Record<string, QueryValue | Record<string, QueryValue>>;

/** Serializes a query object; nested `attrs` become `attr_<key>` parameters. */
export function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined && v !== null && v !== '') params.set(`attr_${k}`, String(v));
      }
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the current access token (or null for anonymous calls). */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Called once on a 401; return true if the token was refreshed and the request should be retried. */
  onUnauthorized?: () => Promise<boolean>;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

interface RequestOptions {
  body?: unknown;
  formData?: FormData;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
}

export type AdminListingItem = ListingCardDto & {
  seller: { id: string; username: string; displayName: string; createdAt: string; status: UserStatus };
  riskScore: number;
  riskReasons: string[];
  moderationNote: string | null;
  updatedAt: string;
};

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  listingCount: number;
  attributes: (AttributeCreateInput & { id: string; categoryId: string })[];
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  sellerType: string;
  verificationStatus: string;
  createdAt: string;
  _count: { listings: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; username: string; displayName: string } | null;
}

export interface AdminStats {
  listingsByStatus: Partial<Record<ListingStatus, number>>;
  users: number;
  categories: number;
  listingsCreatedLast24h: number;
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/$/, '');

  async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    let body: BodyInit | undefined;
    if (opts.formData) body = opts.formData;
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (opts.auth !== false && options.getAccessToken) {
      const token = await options.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let res: Response;
    try {
      res = await doFetch(`${base}${path}${toQueryString(opts.query)}`, { method, headers, body, signal: opts.signal });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new ApiError(0, 'NETWORK_ERROR', (err as Error)?.message ?? 'Network error');
    }
    if (res.status === 401 && !retried && opts.auth !== false && options.onUnauthorized) {
      if (await options.onUnauthorized()) return request<T>(method, path, opts, true);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }
    if (!res.ok) {
      const err = (data ?? {}) as Partial<ApiErrorBody>;
      throw new ApiError(res.status, err.error ?? 'INTERNAL_ERROR', err.message ?? res.statusText, err.issues ?? []);
    }
    return data as T;
  }

  const get = <T>(path: string, query?: Query, auth?: boolean) => request<T>('GET', path, { query, auth });

  return {
    request,
    auth: {
      register: (input: RegisterInput) => request<AuthResponse>('POST', '/v1/auth/register', { body: input, auth: false }),
      login: (input: LoginInput) => request<AuthResponse>('POST', '/v1/auth/login', { body: input, auth: false }),
      refresh: (refreshToken: string) =>
        request<AuthResponse>('POST', '/v1/auth/refresh', { body: { refreshToken }, auth: false }),
      logout: (refreshToken: string) => request<void>('POST', '/v1/auth/logout', { body: { refreshToken }, auth: false }),
      me: () => get<MeDto>('/v1/auth/me'),
    },
    me: {
      update: (input: UpdateProfileInput) => request<MeDto>('PATCH', '/v1/me', { body: input }),
      listings: (query: { status?: ListingStatus; page?: number; pageSize?: number } = {}) =>
        get<Paginated<ListingCardDto>>('/v1/me/listings', query),
    },
    categories: {
      tree: () => get<CategoryNodeDto[]>('/v1/categories', undefined, false),
      detail: (slug: string) => get<CategoryDetailDto>(`/v1/categories/${encodeURIComponent(slug)}`, undefined, false),
    },
    brands: {
      list: (category?: string) => get<BrandDto[]>('/v1/brands', { category }, false),
      models: (brandId: string, categoryId?: string) =>
        get<ProductModelDto[]>(`/v1/brands/${encodeURIComponent(brandId)}/models`, { category: categoryId }, false),
    },
    listings: {
      search: (query: Query = {}) => get<Paginated<ListingCardDto>>('/v1/listings', query, false),
      get: (id: string) => get<ListingDetailDto>(`/v1/listings/${encodeURIComponent(id)}`),
      create: (input: ListingCreateInput) => request<ListingDetailDto>('POST', '/v1/listings', { body: input }),
      update: (id: string, input: ListingUpdateInput) =>
        request<ListingDetailDto>('PATCH', `/v1/listings/${encodeURIComponent(id)}`, { body: input }),
      remove: (id: string) => request<void>('DELETE', `/v1/listings/${encodeURIComponent(id)}`),
      publish: (id: string) => request<ListingDetailDto>('POST', `/v1/listings/${encodeURIComponent(id)}/publish`),
      renew: (id: string) => request<ListingDetailDto>('POST', `/v1/listings/${encodeURIComponent(id)}/renew`),
      close: (id: string, input: ListingCloseInput) =>
        request<ListingDetailDto>('POST', `/v1/listings/${encodeURIComponent(id)}/close`, { body: input }),
      /** `formData` must contain the image under the field name "file". */
      uploadImage: (id: string, formData: FormData) =>
        request<ListingImageDto>('POST', `/v1/listings/${encodeURIComponent(id)}/images`, { formData }),
      deleteImage: (id: string, imageId: string) =>
        request<void>('DELETE', `/v1/listings/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`),
      reorderImages: (id: string, input: ImageOrderInput) =>
        request<ListingImageDto[]>('PUT', `/v1/listings/${encodeURIComponent(id)}/images/order`, { body: input }),
    },
    users: {
      profile: (username: string) => get<PublicUserDto>(`/v1/users/${encodeURIComponent(username)}`, undefined, false),
      listings: (username: string, query: Query = {}) =>
        get<Paginated<ListingCardDto>>(`/v1/users/${encodeURIComponent(username)}/listings`, query, false),
    },
    admin: {
      stats: () => get<AdminStats>('/v1/admin/stats'),
      listings: (query: Partial<AdminListingsQuery> = {}) => get<Paginated<AdminListingItem>>('/v1/admin/listings', query),
      approve: (id: string) => request<{ id: string; status: string }>('POST', `/v1/admin/listings/${encodeURIComponent(id)}/approve`),
      reject: (id: string, reason: string) =>
        request<{ id: string; status: string }>('POST', `/v1/admin/listings/${encodeURIComponent(id)}/reject`, { body: { reason } }),
      remove: (id: string, reason: string) =>
        request<{ id: string; status: string }>('POST', `/v1/admin/listings/${encodeURIComponent(id)}/remove`, { body: { reason } }),
      categories: () => get<AdminCategory[]>('/v1/admin/categories'),
      createCategory: (input: CategoryCreateInput) => request<AdminCategory>('POST', '/v1/admin/categories', { body: input }),
      updateCategory: (id: string, input: CategoryUpdateInput) =>
        request<AdminCategory>('PATCH', `/v1/admin/categories/${encodeURIComponent(id)}`, { body: input }),
      createAttribute: (categoryId: string, input: AttributeCreateInput) =>
        request<unknown>('POST', `/v1/admin/categories/${encodeURIComponent(categoryId)}/attributes`, { body: input }),
      updateAttribute: (id: string, input: AttributeUpdateInput) =>
        request<unknown>('PATCH', `/v1/admin/attributes/${encodeURIComponent(id)}`, { body: input }),
      deleteAttribute: (id: string) => request<void>('DELETE', `/v1/admin/attributes/${encodeURIComponent(id)}`),
      users: (query: Partial<AdminUsersQuery> = {}) => get<Paginated<AdminUser>>('/v1/admin/users', query),
      setUserStatus: (id: string, status: UserStatus, reason?: string) =>
        request<{ id: string; status: UserStatus }>('POST', `/v1/admin/users/${encodeURIComponent(id)}/status`, {
          body: { status, reason },
        }),
      auditLogs: (query: { page?: number; pageSize?: number; entityId?: string } = {}) =>
        get<Paginated<AuditLogEntry>>('/v1/admin/audit-logs', query),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
