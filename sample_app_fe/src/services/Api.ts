import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ApiConfig, DEFAULT_API_CONFIG } from "./Api-Config";
import { Slug } from "./Api-Endpoints";
import { StorageKeys, loadString } from "../utils/storage";

/**
 * Represents the response structure of an API request.
 *
 * @template T - The type of data in the response.
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Represents parameters for making API requests.
 */
export interface APIParameters {
  /**
   * Additional Axios request configuration.
   */
  axiosConfig?: AxiosRequestConfig;

  /**
   * The request body data.
   */
  body?: object;

  /**
   * Query parameters to include in the request.
   */
  queryParameters?: object;

  /**
   * The API endpoint slug.
   */
  slug: Slug | string;
}

/**
 * Service class for making API requests.
 */
export class ApiService {
  // The static instance of the class.
  private static instance: ApiService | null = null;
  /**
   * The underlying axios instance which performs the requests.
   */
  axios: AxiosInstance | undefined;

  /**
   * Configurable options.
   */
  config: ApiConfig;

  /**
   * Private constructor to prevent instantiation from outside the class.
   * Use `ApiService.getInstance()` to get an instance of the class.
   *
   * @param config The configuration to use.
   */
  private constructor(config: ApiConfig = DEFAULT_API_CONFIG) {
    this.config = config;
  }

  /**
   * Returns the instance of the class. If it doesn't exist, creates one.
   *
   * @param config The configuration to use. Optional if the instance already exists.
   * @returns The instance of the class.
   */
  public static getInstance(config?: ApiConfig): ApiService {
    if (!ApiService.instance || config != DEFAULT_API_CONFIG) {
      ApiService.instance = new ApiService(config);
      ApiService.instance.setup();
    } else if (config) {
      ApiService.instance.config = config;
      ApiService.instance.setup();
    }
    return ApiService.instance;
  }

  /**
   * Sets up the API. This will be called during the bootup sequence
   * and will happen before the first component is mounted.
   */
  setup() {
    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        Accept: "application/json",

        // "Content-Type": "application/json",
      },
    });

    this.axios.interceptors.request.use((req: InternalAxiosRequestConfig) => {
      const { url } = req;
      if (url !== Slug.LOGIN && url !== Slug.REGISTER) {
        const accessToken = loadString(StorageKeys.TOKEN);

        if (accessToken) {
          req.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
      return req;
    });

    this.axios.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        if (error.response && error.response.status === 401) {
          // Handle unauthorized error, e.g., redirect to login page
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Performs a GET request.
   *
   * @template T - The expected response data type.
   * @param {APIParameters} param - The API request parameters.
   * @returns {Promise<T | undefined>} - The response data or undefined on error.
   */
  public async get<T>({
    slug,
    axiosConfig = {},
    queryParameters = {},
  }: APIParameters): Promise<T | undefined> {
    if (!this.axios) {
      return;
    }
    const response = await this.axios.get<ApiResponse<T>>(slug, {
      ...axiosConfig,
      params: queryParameters,
    });
    return response.data as unknown as T;
  }

  /**
   * Performs a POST request.
   *
   * @template T - The expected response data type.
   * @param {APIParameters} param - The API request parameters.
   * @returns {Promise<T | undefined>} - The response data or undefined on error.
   */
  public async post<T>({
    slug,
    body,
    axiosConfig = {},
  }: APIParameters): Promise<T | undefined> {
    if (!this.axios) {
      return;
    }
    const response = await this.axios.post<ApiResponse<T>>(
      slug,
      body,
      axiosConfig,
    );
    return response.data as unknown as T;
  }

  /**
   * Performs a PUT request.
   *
   * @template T - The expected response data type.
   * @param {APIParameters} param - The API request parameters.
   * @returns {Promise<T | undefined>} - The response data or undefined on error.
   */
  public async put<T>({
    slug,
    body,
    axiosConfig = {},
  }: APIParameters): Promise<T | undefined> {
    if (!this.axios) {
      return;
    }
    const response = await this.axios.put<ApiResponse<T>>(
      slug,
      body,
      axiosConfig,
    );
    return response.data as unknown as T;
  }

  /**
   * Performs a DELETE request.
   *
   * @template T - The expected response data type.
   * @param {APIParameters} param - The API request parameters.
   * @returns {Promise<T | undefined>} - The response data or undefined on error.
   */
  public async delete<T>({
    slug,
    axiosConfig = {},
    queryParameters = {},
  }: APIParameters): Promise<T | undefined> {
    if (!this.axios) {
      return;
    }
    const response = await this.axios.delete<ApiResponse<T>>(slug, {
      ...axiosConfig,
      params: queryParameters,
    });
    return response.data as unknown as T;
  }

  /**
   * Performs a PATCH request.
   *
   * @template T - The expected response data type.
   * @param {APIParameters} param - The API request parameters.
   * @returns {Promise<T | undefined>} - The response data or undefined on error.
   */
  public async patch<T>({
    slug,
    body,
    axiosConfig = {},
  }: APIParameters): Promise<T | undefined> {
    if (!this.axios) {
      return;
    }
    const response = await this.axios.patch<ApiResponse<T>>(
      slug,
      body,
      axiosConfig,
    );
    return response.data as unknown as T;
  }
}

// Export a singleton instance of the ApiService.

export const API = ApiService.getInstance(DEFAULT_API_CONFIG);
export type API_Request_Status = "SUCCESS" | "NOT_SUCCESS";
