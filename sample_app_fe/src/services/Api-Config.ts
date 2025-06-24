import { Config } from "../config";

/**
 * The options used to configure the API.
 */
export interface ApiConfig {
  /**
   * The URL of the API.
   */
  baseURL: string;

  /**
   * Milliseconds before we timeout the request.
   */
  timeout: number;
}

/**
 * The default configuration for the app.
 */
export const DEFAULT_API_CONFIG: ApiConfig = {
  // Set the base URL for the API to the value from your Config.
  baseURL: Config.API_URL,

  // Set the default timeout for requests (e.g., 600 seconds).
  timeout: 1000 * 60 * 60 * 1000,
};
