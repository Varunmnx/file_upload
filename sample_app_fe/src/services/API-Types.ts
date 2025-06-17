export enum ApiCallStatus {
  Idle = "idle",
  Loading = "loading",
  Failed = "failed",
}

export enum ApiResponseStatus {
  SUCCESS = "SUCCESS",
  NOT_SUCCESS = "NOT_SUCCESS",
}

type ApiStatusCode =
  | 100 // Continue
  | 101 // Switching Protocols
  | 200 // OK
  | 201 // Created
  | 202 // Accepted
  | 203 // Non-Authoritative Information
  | 204 // No Content
  | 205 // Reset Content
  | 206 // Partial Content
  | 300 // Multiple Choices
  | 301 // Moved Permanently
  | 302 // Found
  | 303 // See Other
  | 304 // Not Modified
  | 305 // Use Proxy
  | 307 // Temporary Redirect
  | 400 // Bad Request
  | 401 // Unauthorized
  | 402 // Payment Required
  | 403 // Forbidden
  | 404 // Not Found
  | 405 // Method Not Allowed
  | 406 // Not Acceptable
  | 407 // Proxy Authentication Required
  | 408 // Request Timeout
  | 409 // Conflict
  | 410 // Gone
  | 411 // Length Required
  | 412 // Precondition Failed
  | 413 // Payload Too Large
  | 414 // URI Too Long
  | 415 // Unsupported Media Type
  | 416 // Range Not Satisfiable
  | 417 // Expectation Failed
  | 418 // I'm a teapot (April Fools' joke status code)
  | 422 // Unprocessable Entity
  | 429 // Too Many Requests
  | 500 // Internal Server Error
  | 501 // Not Implemented
  | 502 // Bad Gateway
  | 503 // Service Unavailable
  | 504 // Gateway Timeout
  | 505 // HTTP Version Not Supported
  | number; // Allow for other numeric status codes

/**
 * Represents the response from an API call.
 * @template T - The type of the result in the response.
 */
export class APIResponse<T> {
  constructor(
    public status: ApiResponseStatus,
    public result: T,
    public statusCode: ApiStatusCode,
  ) {}
}

export interface PaginatedData<T> {
  page: number;
  limit: number;
  total: number;
  list: T[];
}

export class APIPaginatedResponse<T> {
  constructor(
    public status: ApiResponseStatus,
    public result: PaginatedData<T>,
    public statusCode: ApiStatusCode,
  ) {}
}

export interface ErrorResponse {
  status: number;
  error?: {
    message?: string;
  };
}
