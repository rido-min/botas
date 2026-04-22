// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { getLogger } from './logger.js'

/** Options for a single HTTP request made by {@link BotHttpClient}. */
export interface BotRequestOptions {
  /** Human-readable description of the operation (used in error messages). */
  operationDescription?: string;
  /** When `true`, a 404 response returns `undefined` instead of throwing. */
  returnNullOnNotFound?: boolean;
  /** Additional request headers to merge in. */
  headers?: Record<string, string>;
}

/** A function that returns a Bearer token for the outgoing request. */
export type TokenProvider = () => Promise<string>

/**
 * Authenticated HTTP client for the Bot Framework REST API.
 *
 * Wraps axios and injects a Bearer token via a request interceptor when a
 * {@link TokenProvider} is supplied.
 *
 * **Lifecycle note:** Create one `BotHttpClient` instance per bot application
 * and reuse it. The request interceptor is attached once in the constructor.
 * Creating many short-lived instances is safe but wasteful — interceptors do
 * not accumulate within a single instance.
 *
 * **Response validation:** Callers are responsible for validating response
 * shapes. The generic type parameter `T` provides compile-time convenience
 * but no runtime schema enforcement.
 */
export class BotHttpClient {
  private readonly http: AxiosInstance

  /**
   * Create a new authenticated HTTP client.
   *
   * @param getToken - Optional token provider. When supplied, every outgoing
   *   request receives a `Bearer` token via an Axios request interceptor.
   *   Omit for unauthenticated calls (dev/testing only).
   */
  constructor (getToken?: TokenProvider) {
    this.http = axios.create({
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    })

    if (getToken) {
      this.http.interceptors.request.use(async (config) => {
        const token = await getToken()
        config.headers.Authorization = `Bearer ${token}`
        return config
      })
    }
  }

  /**
   * Send an HTTP request and return the parsed response body.
   *
   * @typeParam T - Expected shape of the response body (not validated at runtime).
   * @param method - HTTP method (e.g. `"GET"`, `"POST"`).
   * @param url - Fully-qualified URL to request.
   * @param body - Optional request body, serialized as JSON.
   * @param options - Additional request options (error handling, headers).
   * @returns The parsed response body, or `undefined` if the response has no content
   *   or if `returnNullOnNotFound` is set and a 404 was received.
   * @throws {Error} On non-404 HTTP errors, with the method, URL, and status in the message.
   */
  async send<T>(
    method: string,
    url: string,
    body?: unknown,
    options: BotRequestOptions = {}
  ): Promise<T | undefined> {
    const config: AxiosRequestConfig = {
      method,
      url,
      data: body ?? undefined,
      headers: options.headers,
    }

    try {
      const response = await this.http.request<T>(config)
      return response.data ?? undefined
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        if (options.returnNullOnNotFound && err.response?.status === 404) {
          return undefined
        }
        const status = err.response?.status ?? 'no response'
        // #93: Log full upstream body at debug level only; never leak in error messages
        if (err.response?.data !== undefined) {
          getLogger().debug('%s %s upstream response body: %s', method, url, JSON.stringify(err.response.data))
        }
        throw new Error(`${method} ${url} failed with status ${status}`)
      }
      throw err
    }
  }

  /**
   * Send a GET request to a Bot Framework API endpoint.
   *
   * @typeParam T - Expected response body type.
   * @param baseUrl - Service URL base (e.g. `activity.serviceUrl`).
   * @param endpoint - API path (e.g. `/v3/conversations`).
   * @param params - Optional query string parameters; `undefined` values are omitted.
   * @param options - Additional request options.
   * @returns Parsed response body, or `undefined`.
   */
  async get<T>(
    baseUrl: string,
    endpoint: string,
    params?: Record<string, string | undefined>,
    options?: BotRequestOptions
  ): Promise<T | undefined> {
    const url = buildUrl(baseUrl, endpoint, params)
    return this.send<T>('GET', url, undefined, options)
  }

  /**
   * Send a POST request to a Bot Framework API endpoint.
   *
   * @typeParam T - Expected response body type.
   * @param baseUrl - Service URL base.
   * @param endpoint - API path.
   * @param body - Request body, serialized as JSON.
   * @param options - Additional request options.
   * @param params - Optional query string parameters.
   * @returns Parsed response body, or `undefined`.
   */
  async post<T>(
    baseUrl: string,
    endpoint: string,
    body?: unknown,
    options?: BotRequestOptions,
    params?: Record<string, string | undefined>
  ): Promise<T | undefined> {
    const url = buildUrl(baseUrl, endpoint, params)
    return this.send<T>('POST', url, body, options)
  }

  /**
   * Send a PUT request to a Bot Framework API endpoint.
   *
   * @typeParam T - Expected response body type.
   * @param baseUrl - Service URL base.
   * @param endpoint - API path.
   * @param body - Request body, serialized as JSON.
   * @param options - Additional request options.
   * @param params - Optional query string parameters.
   * @returns Parsed response body, or `undefined`.
   */
  async put<T>(
    baseUrl: string,
    endpoint: string,
    body?: unknown,
    options?: BotRequestOptions,
    params?: Record<string, string | undefined>
  ): Promise<T | undefined> {
    const url = buildUrl(baseUrl, endpoint, params)
    return this.send<T>('PUT', url, body, options)
  }

  /**
   * Send a DELETE request to a Bot Framework API endpoint.
   *
   * @param baseUrl - Service URL base.
   * @param endpoint - API path.
   * @param params - Optional query string parameters.
   * @param options - Additional request options.
   */
  async delete (
    baseUrl: string,
    endpoint: string,
    params?: Record<string, string | undefined>,
    options?: BotRequestOptions
  ): Promise<void> {
    const url = buildUrl(baseUrl, endpoint, params)
    await this.send<void>('DELETE', url, undefined, options)
  }
}

function buildUrl (
  baseUrl: string,
  endpoint: string,
  params?: Record<string, string | undefined>
): string {
  const base = baseUrl.replace(/\/$/, '')
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  let url = `${base}${path}`

  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`)
      .join('&')
    if (query) url += `?${query}`
  }

  return url
}

function isAxiosError (err: unknown): err is { response?: { status: number; data?: unknown } } {
  return typeof err === 'object' && err !== null && 'response' in err
}
