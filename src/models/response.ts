export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }

  export interface PaginatedResponse<T> extends APIResponse<T> {
    pagination?: {
      hasMore: boolean;
      nextKey?: string;
    };
  }

